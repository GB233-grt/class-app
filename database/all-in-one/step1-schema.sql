-- ============================================================
-- 积分商城 · 数据库一键初始化（第 1 步：建表）
-- 使用方法：Supabase 控制台 → SQL Editor → New query →
--           粘贴本文件全部内容 → Run
-- 内容：四张表（students / items / redemptions / points_ledger）、
--       索引、积分调整/按数量兑换/发放状态流转原子函数、
--       updated_at 触发器、行级安全（RLS，含教师角色）
-- 说明：只需成功执行一次；重复执行会提示 already exists，无害
--       已有 01~06 旧库请改用 migrations/07_teacher_and_fulfillment.sql 增量升级
-- ============================================================

-- ============================================================
-- 第 1 部分：用户表 students（学生 / 教师 / 管理员）
-- ============================================================
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- 姓名
  student_no text UNIQUE,                      -- 学号（可选）
  email text UNIQUE NOT NULL,                  -- 邮箱（登录用）
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher', 'admin')),  -- 角色：学生/教师/管理员
  points integer NOT NULL DEFAULT 0
    CHECK (points >= 0),                       -- 当前积分余额
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_role ON students(role);

-- ============================================================
-- 第 2 部分：商品（物品）表 items
-- ============================================================
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- 商品名称
  description text,                            -- 商品描述
  cost integer NOT NULL CHECK (cost >= 0),      -- 兑换所需积分（0 = 免费商品）（单价）
  stock integer NOT NULL DEFAULT 0
    CHECK (stock >= 0),                        -- 库存数量
  image_url text,                              -- 商品图片URL
  is_active boolean NOT NULL DEFAULT true,     -- 是否上架（软删除标记，删除=下架）
  type text NOT NULL DEFAULT 'physical'
    CHECK (type IN ('physical', 'digital')),   -- 商品类型：实物商品/网络商品
  publish_date timestamptz,                    -- 网络商品发布日期
  download_url text,                           -- 网络商品下载链接
  download_limit integer NOT NULL DEFAULT 0
    CHECK (download_limit >= 0),               -- 下载次数限制，0=不限制
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_cost ON items(cost ASC);
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;

COMMENT ON COLUMN items.type IS '商品类型：physical=实物商品（有库存、教师线下发放），digital=网络商品（兑换后自动下发下载链接）';
COMMENT ON COLUMN items.publish_date IS '网络商品发布日期（仅 type=digital 时有效）';
COMMENT ON COLUMN items.download_url IS '网络商品下载链接（仅 type=digital 时有效）';
COMMENT ON COLUMN items.download_limit IS '下载次数限制（0=不限制）';

-- ============================================================
-- 第 3 部分：兑换记录表 redemptions
-- ============================================================
CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,                     -- 兑换时的商品名称（快照）
  cost integer NOT NULL,                       -- 兑换时的单价（快照），合计 = cost × quantity
  quantity integer NOT NULL DEFAULT 1
    CHECK (quantity >= 1),                     -- 兑换数量
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled')),-- 发放状态：待发放 / 已发放（教师线下发放确认）
  fulfilled_at timestamptz,                    -- 发放时间
  fulfilled_by uuid REFERENCES students(id) ON DELETE SET NULL, -- 发放操作人（留痕）
  download_url text,                          -- 网络商品下载链接（兑换时的快照）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_student ON redemptions(student_id);
CREATE INDEX idx_redemptions_status ON redemptions(status);
CREATE INDEX idx_redemptions_created ON redemptions(created_at DESC);
CREATE INDEX idx_redemptions_download ON redemptions(item_id) WHERE status = 'fulfilled';

-- ============================================================
-- 第 4 部分：积分明细表 points_ledger
-- ============================================================
CREATE TABLE points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delta integer NOT NULL,                      -- 积分变动值（正=增加，负=减少）
  balance_after integer NOT NULL,              -- 变动后余额
  reason text NOT NULL,                        -- 变动原因
  actor_id uuid REFERENCES students(id) ON DELETE SET NULL, -- 操作者（教师/管理员ID）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_student ON points_ledger(student_id);
CREATE INDEX idx_ledger_created ON points_ledger(created_at DESC);

-- ============================================================
-- 第 5 部分：原子函数（积分调整 / 按数量兑换 / 发放状态流转）与触发器
-- 保证"校验 → 扣减 → 写流水"单事务完成，防止并发超卖、余额错乱
-- ============================================================

-- 判断当前登录用户是否为教师或管理员
CREATE OR REPLACE FUNCTION is_current_staff() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students WHERE id = auth.uid() AND role IN ('teacher', 'admin')
  );
$$;

-- 积分调整（教师/管理员）：校验权限 → 锁行 → 校验余额 → 更新 → 写明细
CREATE OR REPLACE FUNCTION adjust_student_points(
  p_student_id uuid,
  p_delta integer,
  p_reason text,
  p_actor_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance     integer;
  v_new_balance integer;
BEGIN
  IF NOT is_current_staff() THEN
    RAISE EXCEPTION '无权限：仅教师或管理员可调整积分';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION '积分变动值不能为 0';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION '请填写积分变动原因';
  END IF;

  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;

  v_new_balance := v_balance + p_delta;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION '积分不足，无法扣减';
  END IF;

  UPDATE students SET points = v_new_balance WHERE id = p_student_id;

  INSERT INTO points_ledger (student_id, delta, balance_after, reason, actor_id)
  VALUES (p_student_id, p_delta, v_new_balance, trim(p_reason), auth.uid());

  RETURN v_new_balance;
END;
$$;

-- 兑换物品（学生本人）：校验数量 → 上架 → 库存 → 积分 → 原子扣减
CREATE OR REPLACE FUNCTION redeem_item(
  p_student_id uuid,
  p_item_id uuid,
  p_quantity integer DEFAULT 1
) RETURNS TABLE (redemption_id uuid, balance_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name         text;
  v_cost         integer;
  v_stock        integer;
  v_active       boolean;
  v_type         text;
  v_download_url text;
  v_balance      integer;
  v_new_balance  integer;
  v_total        integer;
  v_redemptionId uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION '无权限：只能为自己兑换物品';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION '兑换数量必须为大于 0 的整数';
  END IF;
  IF p_quantity > 99 THEN
    RAISE EXCEPTION '单次兑换数量不能超过 99';
  END IF;

  SELECT name, cost, stock, is_active, type, download_url
    INTO v_name, v_cost, v_stock, v_active, v_type, v_download_url
  FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '商品不存在';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION '商品已下架';
  END IF;

  -- 锁定学生行并校验余额（数字/实物商品都需先扣积分）
  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;
  v_total := v_cost * p_quantity;
  -- 免费商品（v_total = 0）无需校验余额
  IF v_total > 0 AND v_balance < v_total THEN
    RAISE EXCEPTION '积分不足，还需 % 积分', (v_total - v_balance);
  END IF;

  -- 库存校验：实物商品与网络商品统一按库存限量
  IF v_stock < p_quantity THEN
    RAISE EXCEPTION '库存不足，仅剩 % 件', v_stock;
  END IF;

  v_new_balance := v_balance - v_total;

  -- 扣积分（0 积分商品不产生余额变化）+ 扣库存
  IF v_total > 0 THEN
    UPDATE students SET points = v_new_balance WHERE id = p_student_id;
  END IF;
  UPDATE items SET stock = stock - p_quantity WHERE id = p_item_id;

  IF v_type = 'digital' THEN
    -- 网络商品：兑换后自动标记"已发放"并返回下载链接（无需教师干预）
    IF v_download_url IS NULL OR v_download_url = '' THEN
      RAISE EXCEPTION '该商品未配置下载链接，请联系管理员';
    END IF;

    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'fulfilled', v_download_url)
    RETURNING id INTO v_redemptionId;

    -- 只有真正产生积分变化时才写积分明细，避免出现 "+0" 记录
    IF v_total > 0 THEN
      INSERT INTO points_ledger (student_id, delta, balance_after, reason)
      VALUES (
        p_student_id, -v_total, v_new_balance,
        '兑换商品：' || v_name
          || (CASE WHEN p_quantity > 1 THEN ' × ' || p_quantity ELSE '' END)
          || '（已发放下载链接，请到兑换记录查看）'
      );
    END IF;
  ELSE
    -- 实物商品：待教师线下发放（快照商品名称与单价，防止商品变更后历史记录失真）
    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'pending', NULL)
    RETURNING id INTO v_redemptionId;

    IF v_total > 0 THEN
      INSERT INTO points_ledger (student_id, delta, balance_after, reason)
      VALUES (
        p_student_id, -v_total, v_new_balance,
        '兑换商品：' || v_name || (CASE WHEN p_quantity > 1 THEN ' × ' || p_quantity ELSE '' END)
      );
    END IF;
  END IF;

  RETURN QUERY VALUES (v_redemptionId, v_new_balance);
END;
$$;

-- 更新发放状态（教师/管理员）：待发放 ↔ 已发放，留痕可撤回
CREATE OR REPLACE FUNCTION update_redemption_status(
  p_redemption_id uuid,
  p_new_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_item_id uuid;
  v_item_type text;
BEGIN
  IF p_new_status NOT IN ('pending', 'fulfilled') THEN
    RAISE EXCEPTION '非法的发放状态';
  END IF;
  IF NOT is_current_staff() THEN
    RAISE EXCEPTION '无权限：仅教师或管理员可更新发放状态';
  END IF;

  SELECT r.status, r.item_id, i.type
    INTO v_current, v_item_id, v_item_type
  FROM redemptions r
  JOIN items i ON i.id = r.item_id
  WHERE r.id = p_redemption_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '兑换记录不存在';
  END IF;
  IF v_current = p_new_status THEN
    RAISE EXCEPTION '发放状态未发生变化';
  END IF;

  -- 网络商品兑换记录不得回退为"待发放"（避免学生下载不到链接）
  IF v_item_type = 'digital' AND p_new_status = 'pending' THEN
    RAISE EXCEPTION '网络商品已自动发放下载链接，不可撤回';
  END IF;

  UPDATE redemptions
    SET status = p_new_status,
        fulfilled_at = CASE WHEN p_new_status = 'fulfilled' THEN now() ELSE NULL END,
        fulfilled_by = CASE WHEN p_new_status = 'fulfilled' THEN auth.uid() ELSE NULL END
    WHERE id = p_redemption_id;
END;
$$;

-- 商品表 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 函数执行权限：仅登录用户可调用（拒绝匿名）
REVOKE ALL ON FUNCTION adjust_student_points(uuid, integer, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION adjust_student_points(uuid, integer, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION update_redemption_status(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION update_redemption_status(uuid, text) TO authenticated;

-- ============================================================
-- 第 6 部分：行级安全（RLS）
-- 学生凭证只能读自己的数据；教师可只读学生名单与全部兑换记录
-- ============================================================
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- 判断当前登录用户是否为管理员
CREATE OR REPLACE FUNCTION is_current_admin() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "学生可查看自己的资料"
  ON students FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_current_staff());

CREATE POLICY "登录用户可查看商品"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "用户可查看自己的兑换记录"
  ON redemptions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_staff());

CREATE POLICY "用户可查看自己的积分明细"
  ON points_ledger FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_admin());
