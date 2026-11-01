-- ============================================================
-- 03_create_items.sql —— 插入示例商品数据（模板，不自动执行）
--
-- 说明：用户可根据学校商店实际情况自由修改以下商品数据，
--       修改后再在 Supabase SQL Editor 中执行。
-- ============================================================

-- 商品类型：physical = 实物商品（有库存，教师线下发放）
--           digital = 网络商品（不扣库存，兑换后自动下发下载链接）
INSERT INTO items (name, description, cost, stock, type, download_url, publish_date) VALUES
  -- 实物商品（线下发放）
  ('学校笔记本',     'A5硬壳笔记本，120页',         30,  50, 'physical', NULL, NULL),
  ('中性笔套装',     '5支蓝色中性笔装',            15,  100, 'physical', NULL, NULL),
  ('保温水瓶',       '750ml不锈钢保温瓶带校徽',    80,  20, 'physical', NULL, NULL),
  ('帆布托特包',     '环保帆布包印校徽',           60,  30, 'physical', NULL, NULL),
  ('科学计算器',     '卡西欧FX-991EX',             200, 8,  'physical', NULL, NULL),
  ('图书馆通行证',   '全天优先自习室使用权',       25, 999, 'physical', NULL, NULL),
  ('无线耳机',       '蓝牙耳机带充电盒',           300, 5,  'physical', NULL, NULL),
  ('电影票兑换券',   '单次影院兑换券',             120, 15, 'physical', NULL, NULL),
  -- 网络商品（线上下载）
  ('答案解析网络版', '全年题库解析，购买后下载',   50,  0, 'digital', 'https://example.com/downloads/answers.zip', NULL)
