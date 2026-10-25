-- ============================================================
-- 07_teacher_and_fulfillment.sql —— 教师角色 + 按数量兑换 + 线下发放
-- 执行方式：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
--
-- 适用对象：已经执行过 01~06 的现有数据库（增量升级，不影响已有数据）
-- 全新数据库请改用 database/all-in-one/step1-schema.sql（已包含本文件全部内容）
--
-- 内容：
--   1. students.role 新增 'teacher'（教师角色）
--   2. redemptions 新增 quantity / status / fulfilled_at / fulfilled_by
--   3. redeem_item 支持兑换数量，并限制只能为自己兑换
--   4. adjust_student_points 增加权限校验（仅教师/管理员可调用）
--   5. 新增 update_redemption_status（发放状态流转，留痕可撤回）
--   6. RLS：教师可只读访问学生名单与全部兑换记录
--
-- 说明：执行一次即可。请勿重复执行（重复执行会因函数已存在而整体回滚，无害但请避免）
-- ============================================================

-- ------------------------------------------------------------
-- 1. 角色扩展：新增教师
-- ------------------------------------------------------------
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_role_check;
ALTER TABLE students ADD CONSTRAINT students_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));

-- ------------------------------------------------------------
-- 2. 兑换记录扩展：数量 + 发放状态 + 发放留痕
-- ------------------------------------------------------------

-- 兑换数量（正整数，历史记录自动为 1）
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1
  CHECK (quantity >= 1);

-- 发放状态：pending=待发放，fulfilled=已发放（历史记录自动为待发放）
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'fulfilled'));

-- 发放时间与操作人（审计留痕；教师账号删除时自动置空）
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS fulfilled_by uuid
  REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status);

-- cost 列语义明确为"兑换时的单价快照"，合计积分 = cost × quantity
COMMENT ON COLUMN redemptions.cost IS '兑换时的单价快照；合计积分 = cost × quantity';

-- ------------------------------------------------------------
-- 3. 安全辅助函数：是否教师或管理员（staff）
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 4. 积分调整：增加调用者权限校验
--    防止学生拿到自己的 JWT 后绕过后端、直接调用 RPC 给自己加分
--    （操作人一律以实际调用者 auth.uid() 记录，防止伪造 actor）
-- ------------------------------------------------------------

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
  VALUES (p_student_id, p_delta, v_new_balance, trim(p_reason), auth.uid());

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION adjust_student_points(uuid, integer, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION adjust_student_points(uuid, integer, text, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. 兑换物品：支持兑换数量
--    校验链：仅限本人 → 数量合法（1~99）→ 商品上架 → 库存足够 → 积分足够
--    原子完成：扣积分、扣库存、写兑换记录（快照）、写积分明细
-- ------------------------------------------------------------

-- 先删除旧的双参数版本，避免接口残留
DROP FUNCTION IF EXISTS redeem_item(uuid, uuid);

CREATE FUNCTION redeem_item(
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
  v_balance      integer;
  v_new_balance  integer;
  v_total        integer;
  v_redemptionId uuid;
BEGIN
  -- 只能为自己兑换（防止替他人消费积分）
  IF auth.uid() IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION '无权限：只能为自己兑换物品';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION '兑换数量必须为大于 0 的整数';
  END IF;
  IF p_quantity > 99 THEN
    RAISE EXCEPTION '单次兑换数量不能超过 99';
  END IF;

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
  IF v_stock < p_quantity THEN
    RAISE EXCEPTION '库存不足，仅剩 % 件', v_stock;
  END IF;

  -- 锁定学生行并校验积分
  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;
  v_total := v_cost * p_quantity;
  IF v_balance < v_total THEN
    RAISE EXCEPTION '积分不足，还需 % 积分', (v_total - v_balance);
  END IF;

  v_new_balance := v_balance - v_total;

  UPDATE students SET points = v_new_balance WHERE id = p_student_id;
  UPDATE items SET stock = stock - p_quantity WHERE id = p_item_id;

  -- 兑换记录（快照商品名称与单价，防止商品变更后历史记录失真）
  INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity)
  VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity)
  RETURNING id INTO v_redemptionId;

  INSERT INTO points_ledger (student_id, delta, balance_after, reason)
  VALUES (
    p_student_id, -v_total, v_new_balance,
    '兑换商品：' || v_name || (CASE WHEN p_quantity > 1 THEN ' × ' || p_quantity ELSE '' END)
  );

  RETURN QUERY VALUES (v_redemptionId, v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid, integer) TO authenticated;

-- ------------------------------------------------------------
-- 6. 更新发放状态（教师/管理员）
--    pending  -> fulfilled：记录发放时间与操作人
--    fulfilled -> pending：撤回（留痕清空；不退积分，积分在兑换时已扣除）
-- ------------------------------------------------------------

CREATE FUNCTION update_redemption_status(
  p_redemption_id uuid,
  p_new_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
BEGIN
  IF p_new_status NOT IN ('pending', 'fulfilled') THEN
    RAISE EXCEPTION '非法的发放状态';
  END IF;
  IF NOT is_current_staff() THEN
    RAISE EXCEPTION '无权限：仅教师或管理员可更新发放状态';
  END IF;

  SELECT status INTO v_current FROM redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '兑换记录不存在';
  END IF;
  IF v_current = p_new_status THEN
    RAISE EXCEPTION '发放状态未发生变化';
  END IF;

  UPDATE redemptions
    SET status = p_new_status,
        fulfilled_at = CASE WHEN p_new_status = 'fulfilled' THEN now() ELSE NULL END,
        fulfilled_by = CASE WHEN p_new_status = 'fulfilled' THEN auth.uid() ELSE NULL END
    WHERE id = p_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION update_redemption_status(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION update_redemption_status(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 7. RLS 策略更新：教师可只读访问学生名单与全部兑换记录
--    （写入仍仅限后端 API 与上面的安全函数）
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "学生可查看自己的资料" ON students;
CREATE POLICY "学生可查看自己的资料"
  ON students FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_current_staff());

DROP POLICY IF EXISTS "用户可查看自己的兑换记录" ON redemptions;
CREATE POLICY "用户可查看自己的兑换记录"
  ON redemptions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_staff());

-- 说明：积分明细（points_ledger）保持仅本人/管理员可读，教师无需访问
