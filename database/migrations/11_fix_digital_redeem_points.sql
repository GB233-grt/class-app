-- ============================================================
-- 11_fix_digital_redeem_points.sql —— 修复「网络商品兑换不扣积分」的严重缺陷
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 缺陷说明：
--   09_item_types.sql 升级 redeem_item 时，digital（网络商品）分支只写入了
--   兑换记录和积分明细（points_ledger），但漏掉了
--       UPDATE students SET points = v_new_balance WHERE id = p_student_id;
--   导致：
--     · 学生余额从未真正扣减 —— 1 积分可以无限次兑换网络商品；
--     · points_ledger 里记录的 balance_after 与 students.points 不一致。
--   实物商品（physical）分支有这句 UPDATE，因此不受影响。
--
-- 本脚本内容：
--   1. 重建 redeem_item：网络商品分支补上扣减余额（其余逻辑保持不变）
--   2. 给出历史数据不一致的检查语句，并提供可选的修复语句
-- ============================================================

-- ------------------------------------------------------------
-- 1. 重建 redeem_item（网络商品也真正扣分）
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

  -- 锁定学生行并校验余额（网络商品 / 实物商品都必须先扣积分）
  SELECT points INTO v_balance FROM students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '学生不存在';
  END IF;
  v_total := v_cost * p_quantity;
  IF v_balance < v_total THEN
    RAISE EXCEPTION '积分不足，还需 % 积分', (v_total - v_balance);
  END IF;
  v_new_balance := v_balance - v_total;

  -- 网络商品：不扣库存，兑换后自动标记"已发放"并返回下载链接（无需教师干预）
  IF v_type = 'digital' THEN
    IF v_download_url IS NULL OR v_download_url = '' THEN
      RAISE EXCEPTION '该商品未配置下载链接，请联系管理员';
    END IF;

    -- ★ 修复点：网络商品同样必须真实扣减学生积分（原脚本遗漏此句）
    UPDATE students SET points = v_new_balance WHERE id = p_student_id;

    -- 网络商品进入"已发放"状态，无需教师干预
    INSERT INTO redemptions (student_id, item_id, item_name, cost, quantity, status, download_url)
    VALUES (p_student_id, p_item_id, v_name, v_cost, p_quantity, 'fulfilled', v_download_url)
    RETURNING id INTO v_redemptionId;

    INSERT INTO points_ledger (student_id, delta, balance_after, reason)
    VALUES (
      p_student_id, -v_total, v_new_balance,
      '兑换商品：' || v_name || '（已发放下载链接，请到兑换记录查看）'
    );
  ELSE
    -- 实物商品：先检查库存，库存不足则终止
    IF v_stock < p_quantity THEN
      RAISE EXCEPTION '库存不足，仅剩 % 件', v_stock;
    END IF;

    UPDATE students SET points = v_new_balance WHERE id = p_student_id;
    UPDATE items SET stock = stock - p_quantity WHERE id = p_item_id;

    -- 兑换记录（快照商品名称与单价，防止商品变更后历史记录失真）
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
-- 2. 历史数据检查（只读，可放心执行）
--    以积分明细的最后一条 balance_after 为准，列出与实际余额不一致的学生
-- ------------------------------------------------------------
-- SELECT s.id,
--        s.name,
--        s.points                                        AS 实际余额,
--        l.balance_after                                 AS 按明细应为,
--        l.balance_after - s.points                      AS 差额
-- FROM students s
-- JOIN (
--   SELECT DISTINCT ON (student_id) student_id, balance_after, created_at
--   FROM points_ledger
--   ORDER BY student_id, created_at DESC, id DESC
-- ) l ON l.student_id = s.id
-- WHERE s.points <> l.balance_after
-- ORDER BY 差额;

-- ------------------------------------------------------------
-- 3. 历史数据修复（可选，谨慎执行）
--    注意：仅当「积分明细完整」时才可执行——即所有加/扣分都经过
--    adjust_student_points / redeem_item 函数（本项目默认如此）。
--    若你曾直接在数据库里改过 students.points，请先人工核对再加下面这段。
-- ------------------------------------------------------------
-- UPDATE students s
-- SET points = l.balance_after
-- FROM (
--   SELECT DISTINCT ON (student_id) student_id, balance_after
--   FROM points_ledger
--   ORDER BY student_id, created_at DESC, id DESC
-- ) l
-- WHERE s.id = l.student_id
--   AND s.points <> l.balance_after;

-- ------------------------------------------------------------
-- 4. 验证
-- ------------------------------------------------------------
-- SELECT p.proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'redeem_item';
