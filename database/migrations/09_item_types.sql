-- ============================================================
-- 09_item_types.sql —— 商品类型：网络商品 / 实物商品
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内裠 → Run
--
-- 适用对象：已经执行过 01~08 的现有数据库（增量升级，不影响已有数据）
-- 全新数据库请改用 database/all-in-one/step1-schema.sql（已包含本文件全部内容）
--
-- 内容：
--   1. items 表新增 type（physical=实物商品 / digital=网络商品）
--      + publish_date / download_url / download_limit（网络商品下载链接与发放设置）
--   2. redemptions 新增 download_url（下载链接快照）
--   3. 升级 redeem_item：网络商品兑换自动"已发放"并记录链接，不扣库存
-- ============================================================

-- ------------------------------------------------------------
-- 1. 商品类型（仅实例/教师/管理员的录入入口新增一个维度）
-- ------------------------------------------------------------

-- type：physical=实物商品（有库存，下沉发放），digital=网络商品（兑换后自动下发下载链接）
ALTER TABLE items ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'physical'
  CHECK (type IN ('physical', 'digital'));

-- 网络商品发布日期（商品上新时间，仅 type=digital 时使用）
ALTER TABLE items ADD COLUMN IF NOT EXISTS publish_date timestamptz;

-- 网络商品下载链接（学生兑换后可见，用于课后下载资料）
ALTER TABLE items ADD COLUMN IF NOT EXISTS download_url text;

-- 下载次数限制（0=不限制，仅 type=digital 时使用）
ALTER TABLE items ADD COLUMN IF NOT EXISTS download_limit integer NOT NULL DEFAULT 0
  CHECK (download_limit >= 0);

COMMENT ON COLUMN items.type IS '商品类型：physical=实物商品（有库存、教师线下发放），digital=网络商品（兑换后自动下发下载链接）';
COMMENT ON COLUMN items.publish_date IS '网络商品发布日期（仅 type=digital 时有效）';
COMMENT ON COLUMN items.download_url IS '网络商品下载链接（仅 type=digital 时有效，需设置）';
COMMENT ON COLUMN items.download_limit IS '下载次数限制（0=不限制）';

-- ------------------------------------------------------------
-- 2. 兑换记录：网络商品下载链接快照
-- ------------------------------------------------------------

-- download_url 记录兑换时下发给学生的下载链接（商品变更后历史记录同样可见）
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS download_url text
  DEFAULT NULL;

COMMENT ON COLUMN redemptions.download_url IS '网络商品下载链接（兑换时的快照）';

-- ------------------------------------------------------------
-- 3. 升级 redeem_item：网络商品兑换自动发放下载链接
--    实物商品保持原逻辑：扣库存、待下放
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

  -- 锁定学生行并校验余额（数字/实物商品都需先扣积分）
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
    -- 实物商品：先检查库存，商品库存不足时终止
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
-- 4. 升级 update_redemption_status：数字商品自动发放的记录
--    由系统自动标记为已发放，教师不可改为"待发放"（避免学生下载不到）
-- ------------------------------------------------------------

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

  -- 网络商品兑换记录不得回退为"待发放"（避免链接无法下载）
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
