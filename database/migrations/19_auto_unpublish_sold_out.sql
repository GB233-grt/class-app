-- ============================================================
-- 19_auto_unpublish_sold_out.sql —— 商品售罄后自动下架
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 规则：
--   · 实物 / 网络商品在成功兑换后库存降为 0 时，自动 is_active=false
--   · 下架与扣库存处于同一数据库事务，不存在「库存 0 但仍上架」窗口
--   · 兑换记录、积分流水和网络商品下载链接仍正常写入
--   · 管理员可通过商品编辑补充库存，再手动上架
--   · 手动把库存改成 0 的商品不会被本迁移自动下架；自动规则只在兑换扣到 0 时触发
--
-- 本脚本以迁移 13 的免费商品函数为基础，保留扣积分、库存、免费商品逻辑。
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
  v_new_stock    integer;
  v_redemptionId uuid;
BEGIN
  -- 只能为自己兑换
  IF auth.uid() IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION '无权限：只能为自己兑换物品';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION '兑换数量必须为大于 0 的整数';
  END IF;
  IF p_quantity > 99 THEN
    RAISE EXCEPTION '单次兑换数量不能超过 99';
  END IF;

  -- 锁定商品行，防止并发超卖
  SELECT name, cost, stock, is_active, type, download_url
    INTO v_name, v_cost, v_stock, v_active, v_type, v_download_url
  FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '商品不存在';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION '商品已下架';
  END IF;

  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;

  v_total := v_cost * p_quantity;
  IF v_total > 0 AND v_balance < v_total THEN
    RAISE EXCEPTION '积分不足，还需 % 积分', (v_total - v_balance);
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION '库存不足，仅剩 % 件', v_stock;
  END IF;

  IF v_type = 'digital' AND (v_download_url IS NULL OR v_download_url = '') THEN
    RAISE EXCEPTION '该商品未配置下载链接，请联系管理员';
  END IF;

  v_new_balance := v_balance - v_total;
  v_new_stock := v_stock - p_quantity;

  -- 扣积分（0 积分不写积分变动）
  IF v_total > 0 THEN
    UPDATE students SET points = v_new_balance WHERE id = p_student_id;
  END IF;

  -- 扣库存，并在本事务内库存归零时自动下架
  UPDATE items
     SET stock = v_new_stock,
         is_active = CASE WHEN v_new_stock = 0 THEN false ELSE is_active END,
         updated_at = CASE WHEN v_new_stock = 0 THEN now() ELSE updated_at END
   WHERE id = p_item_id;

  IF v_type = 'digital' THEN
    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'fulfilled', v_download_url)
    RETURNING id INTO v_redemptionId;

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

-- 下架前库存必须至少有 1 件；因此当前约束下自动售罄的条件就是 stock = 0。
-- 验证函数：
-- SELECT pg_get_functiondef('redeem_item(uuid,uuid,integer)'::regprocedure);
