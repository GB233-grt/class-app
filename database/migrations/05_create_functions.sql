-- ============================================================
-- 05_create_functions.sql —— 数据库函数（原子操作）与触发器
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
--
-- 说明：积分调整与物品兑换都必须"读余额/库存 → 校验 → 扣减 → 写流水"
--       在一次数据库事务内原子完成，避免并发请求导致库存超卖或积分错乱。
--       函数为 SECURITY DEFINER，仅授予登录用户（authenticated）执行权限。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 积分调整（管理员增减学生积分）
--    返回：调整后的最新余额
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

-- ------------------------------------------------------------
-- 2. 兑换物品（学生用积分兑换商品）
--    原子完成：锁商品行 → 校验上架/库存/积分 → 扣积分扣库存 →
--    写兑换记录（商品名/价格快照）→ 写积分明细
--    返回：兑换记录 ID 与兑换后余额
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3. updated_at 自动更新触发器（商品表）
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. 函数执行权限：仅登录用户可调用（拒绝匿名）
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION adjust_student_points(uuid, integer, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION adjust_student_points(uuid, integer, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid) TO authenticated;
