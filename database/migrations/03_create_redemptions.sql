-- ============================================================
-- 03_create_redemptions.sql —— 兑换记录表
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
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
