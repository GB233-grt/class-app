-- ============================================================
-- 12_digital_stock_limit.sql —— 网络商品也按库存限量
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 背景：
--   09_item_types.sql 引入网络商品时，设计上"网络商品不扣库存"，
--   所以 redeem_item 的 digital 分支既不校验库存、也不扣减库存，
--   前端商品卡片也不展示库存（显示"网络商品"徽标）。
--   结果：管理员给网络商品填的「库存数量 1」完全不生效，可以无限兑换。
--
-- 本脚本：
--   1. 重建 redeem_item：网络商品与实物商品统一按库存校验 + 扣减库存
--      （两类商品的差异只剩「是否自动发放下载链接」）
--   2. 说明下载次数限制的现状
--
-- 注意：本脚本已包含 11_fix_digital_redeem_points.sql 的扣积分修复，
--       若你还没执行过 11，直接执行本脚本即可。
-- ============================================================

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
  IF v_balance < v_total THEN
    RAISE EXCEPTION '积分不足，还需 % 积分', (v_total - v_balance);
  END IF;

  -- ★ 库存校验：实物商品与网络商品统一按库存限量
  IF v_stock < p_quantity THEN
    RAISE EXCEPTION '库存不足，仅剩 % 件', v_stock;
  END IF;

  v_new_balance := v_balance - v_total;

  -- ★ 扣积分 + 扣库存（两类商品都要执行）
  UPDATE students SET points = v_new_balance WHERE id = p_student_id;
  UPDATE items SET stock = stock - p_quantity WHERE id = p_item_id;

  IF v_type = 'digital' THEN
    -- 网络商品：兑换后自动"已发放"并下发下载链接
    IF v_download_url IS NULL OR v_download_url = '' THEN
      RAISE EXCEPTION '该商品未配置下载链接，请联系管理员';
    END IF;

    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'fulfilled', v_download_url)
    RETURNING id INTO v_redemptionId;

    INSERT INTO points_ledger (student_id, delta, balance_after, reason)
    VALUES (
      p_student_id, -v_total, v_new_balance,
      '兑换商品：' || v_name
        || (CASE WHEN p_quantity > 1 THEN ' × ' || p_quantity ELSE '' END)
        || '（已发放下载链接，请到兑换记录查看）'
    );
  ELSE
    -- 实物商品：待教师线下发放
    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'pending', NULL)
    RETURNING id INTO v_redemptionId;

    INSERT INTO points_ledger (student_id, delta, balance_after, reason)
    VALUES (
      p_student_id, -v_total, v_new_balance,
      '兑换商品：' || v_name || (CASE WHEN p_quantity > 1 THEN ' × ' || p_quantity ELSE '' END)
    );
  END IF;

  RETURN QUERY VALUES (v_redemptionId, v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION redeem_item(uuid, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION redeem_item(uuid, uuid, integer) TO authenticated;

-- ------------------------------------------------------------
-- 关于「下载次数限制」download_limit
-- ------------------------------------------------------------
-- 该字段目前只是保存下来、在管理端可编辑，系统并没有提供"带计数的下载接口"，
-- 学生拿到的就是 redemptions.download_url 里的原始链接，可以直接访问。
-- 因此 download_limit 目前【不会】限制任何东西。
-- 若需要真正限制下载次数，需要额外实现一个 /api/downloads/:redemptionId 代理接口
-- （每次下载计数 + 超限拒绝），属于独立功能，本次未包含。
--
-- 现阶段"这个网络商品只能被兑换 1 次"请用【库存数量 1】控制——本脚本已让库存生效。

-- ------------------------------------------------------------
-- 历史数据提醒
-- ------------------------------------------------------------
-- 之前的网络商品兑换没有扣库存，items.stock 可能偏大。如需校正，可参考：
--   SELECT i.name, i.stock AS 当前库存,
--          i.stock - COALESCE(x.used, 0) AS 建议库存
--   FROM items i
--   LEFT JOIN (
--     SELECT item_id, SUM(quantity) AS used FROM redemptions WHERE status = 'fulfilled' GROUP BY item_id
--   ) x ON x.item_id = i.id
--   WHERE i.type = 'digital';
-- 核对无误后再决定是否调整（不要直接批量改，避免误伤已人工调整过的数据）。

-- ------------------------------------------------------------
-- 验证
-- ------------------------------------------------------------
-- SELECT p.proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'redeem_item';
