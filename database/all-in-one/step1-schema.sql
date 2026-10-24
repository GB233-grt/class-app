-- ============================================================
-- 积分商城 · 数据库一键初始化（第 1 步：建表）
-- 使用方法：Supabase 控制台 → SQL Editor → New query →
--           粘贴本文件全部内容 → Run
-- 内容：四张表（students / items / redemptions / points_ledger）、
--       索引、积分调整与物品兑换原子函数、updated_at 触发器、行级安全（RLS）
-- 说明：只需成功执行一次；重复执行会提示 already exists，无害
-- ============================================================

-- ============================================================
-- 第 1 部分：学生表 students
-- ============================================================
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- 学生姓名
  student_no text UNIQUE,                      -- 学号（可选）
  email text UNIQUE NOT NULL,                  -- 邮箱（登录用）
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin')),      -- 角色：学生或管理员（预留扩展空间）
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
  cost integer NOT NULL CHECK (cost > 0),      -- 兑换所需积分
  stock integer NOT NULL DEFAULT 0
    CHECK (stock >= 0),                        -- 库存数量
  image_url text,                              -- 商品图片URL
  is_active boolean NOT NULL DEFAULT true,     -- 是否上架（软删除标记，删除=下架）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_cost ON items(cost ASC);
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;

-- ============================================================
-- 第 3 部分：兑换记录表 redemptions
-- ============================================================
CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,                     -- 兑换时的商品名称（快照）
  cost integer NOT NULL,                       -- 兑换时的积分消耗（快照）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_student ON redemptions(student_id);
CREATE INDEX idx_redemptions_created ON redemptions(created_at DESC);

-- ============================================================
-- 第 4 部分：积分明细表 points_ledger
-- ============================================================
CREATE TABLE points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delta integer NOT NULL,                      -- 积分变动值（正=增加，负=减少）
  balance_after integer NOT NULL,              -- 变动后余额
  reason text NOT NULL,                        -- 变动原因（可扩展枚举）
  actor_id uuid REFERENCES students(id) ON DELETE SET NULL, -- 操作者（管理员ID）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_student ON points_ledger(student_id);
CREATE INDEX idx_ledger_created ON points_ledger(created_at DESC);

-- ============================================================
-- 第 5 部分：原子函数（积分调整 / 物品兑换）与触发器
-- 保证"校验 → 扣减 → 写流水"单事务完成，防止并发超卖、余额错乱
-- ============================================================
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
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION '积分变动值不能为 0';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION '请填写积分变动原因';
  END IF;

  -- 锁定学生行，防止并发调整
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
  VALUES (p_student_id, p_delta, v_new_balance, trim(p_reason), p_actor_id);

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION redeem_item(
  p_student_id uuid,
  p_item_id uuid
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
  v_balance      integer;
  v_new_balance  integer;
  v_redemptionId uuid;
BEGIN
  -- 锁定商品行，防止超卖
  SELECT name, cost, stock, is_active
    INTO v_name, v_cost, v_stock, v_active
  FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '商品不存在';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION '商品已下架';
  END IF;
  IF v_stock < 1 THEN
    RAISE EXCEPTION '商品库存不足';
  END IF;

  -- 锁定学生行并校验积分
  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION '积分不足';
  END IF;

  v_new_balance := v_balance - v_cost;

  UPDATE students SET points = v_new_balance WHERE id = p_student_id;
  UPDATE items SET stock = stock - 1 WHERE id = p_item_id;

  -- 兑换记录（快照商品名称与消耗积分，防止商品变更后历史记录失真）
  INSERT INTO redemptions (student_id, item_id, item_name, cost)
  VALUES (p_student_id, p_item_id, v_name, v_cost)
  RETURNING id INTO v_redemptionId;

  INSERT INTO points_ledger (student_id, delta, balance_after, reason)
  VALUES (p_student_id, -v_cost, v_new_balance, '兑换商品：' || v_name);

  RETURN QUERY VALUES (v_redemptionId, v_new_balance);
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

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid) TO authenticated;

-- ============================================================
-- 第 6 部分：行级安全（RLS）
-- 普通用户凭证只能读自己的数据；所有写操作走后端或安全函数
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
  USING (id = auth.uid() OR is_current_admin());

CREATE POLICY "登录用户可查看商品"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "用户可查看自己的兑换记录"
  ON redemptions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_admin());

CREATE POLICY "用户可查看自己的积分明细"
  ON points_ledger FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_admin());
