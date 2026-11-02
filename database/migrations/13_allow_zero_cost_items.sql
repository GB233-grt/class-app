-- ============================================================
-- 13_allow_zero_cost_items.sql —— 允许商品价格为 0（免费商品）
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 内容：
--   1. items.cost 约束从 CHECK (cost > 0) 放宽为 CHECK (cost >= 0)
--   2. 重建 redeem_item：
--      · 0 积分商品照常兑换（扣库存 / 自动发放）
--      · 0 积分不再写「+0」的积分明细，避免积分明细里出现无意义的红色 0
--        （兑换记录仍然完整保留）
--
-- 说明：本脚本已包含 11（扣积分修复）与 12（网络商品按库存限量）的全部逻辑，
--       若尚未执行过 11 / 12，只执行本脚本即可。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 放宽价格约束：0 = 免费商品
-- ------------------------------------------------------------

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_cost_check;
ALTER TABLE items
  ADD CONSTRAINT items_cost_check CHECK (cost >= 0);

COMMENT ON COLUMN items.cost IS '兑换所需积分（0 表示免费商品，不消耗学生积分）';

-- ------------------------------------------------------------
-- 2. 重建 redeem_item：支持 0 积分商品
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS redeem_item(uuid, uuid, integer);

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
  v_type         text;
  v_download_url text;
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
  SELECT name, cost, stock, is_active, type, download_url
    INTO v_name, v_cost, v_stock, v_active, v_type, v_download_url
  FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '商品不存在';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION '商品已下架';
  END IF;

  -- 锁定学生行并校验余额
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
    -- 网络商品：兑换后自动"已发放"并下发下载链接
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
    -- 实物商品：待教师线下发放
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

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid, integer) TO authenticated;

-- ------------------------------------------------------------
-- 验证
-- ------------------------------------------------------------
-- SELECT p.proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'redeem_item';
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conrelid = 'items'::regclass AND conname = 'items_cost_check';
