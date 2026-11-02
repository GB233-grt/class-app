-- ============================================================
-- 14_item_expiry.sql —— 商品到期自动下架（实物 / 网络商品通用）
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 内容：
--   1. items 新增 expires_at（到期时间，NULL = 永不过期）
--   2. 新增 expire_items() 函数：把已到期的上架商品批量下架，返回下架数量
--   3. 页面加载 / 列表刷新时由后端自动调用它（惰性清理，无需定时任务）
--
-- 设计说明：
--   · 用「惰性清理」而不是数据库定时任务（pg_cron）：每次 /api/items 请求
--     先执行一次 expire_items()，已过期商品立即变为 is_active=false，
--     出现在管理员后台的「已下架」分组，学生端不再可见。
--   · 到期后是"下架"而不是"删除"：兑换记录、积分明细全部保留，
--     管理员把到期时间改到未来并重新上架，商品即可继续售卖。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 到期时间
-- ------------------------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN items.expires_at IS '商品到期时间（NULL=永不过期）；到期后自动下架';

-- 只对设置了到期时间的行建部分索引，让清理扫描足够快
CREATE INDEX IF NOT EXISTS idx_items_expires_at
  ON items(expires_at)
  WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- 2. 到期清理函数
--    返回本次下架的商品数量（0 表示没有到期的）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE items
       SET is_active = false,
           updated_at = now()
     WHERE is_active = true
       AND expires_at IS NOT NULL
       AND expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION expire_items() TO authenticated;

-- ------------------------------------------------------------
-- 3. 一次性清理（执行本脚本时先把已过期的商品下架）
-- ------------------------------------------------------------
SELECT expire_items() AS 本次下架商品数;

-- ------------------------------------------------------------
-- 验证
-- ------------------------------------------------------------
-- SELECT name, is_active, expires_at
-- FROM items
-- WHERE expires_at IS NOT NULL
-- ORDER BY expires_at;
