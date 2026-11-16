-- ============================================================
-- 18_promo_pages.sql —— 启幕宣传页
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 说明：
--   · 记录在启动/进入首页时展示的正能量宣传内容（如「学习红岩精神」）
--   · 内容需审核后才可发布；教师可提交，管理员审核与上下线
--   · 表只由后端 service_role 读写，因此 RLS 开启但不建任何策略（默认拒绝）
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  image_url     text,
  link_url      text,
  link_label    text CHECK (link_label IS NULL OR char_length(link_label) <= 12),
  -- 展示频次：每次启动 / 每日一次 / 同一内容仅一次
  frequency     text NOT NULL DEFAULT 'daily'
                CHECK (frequency IN ('once_per_launch', 'daily', 'once_per_content')),
  -- 受众：all=所有人 / student=仅学生 / staff=仅教职工
  audience      text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'student', 'staff')),
  -- 归属区域：NULL = 全校可见
  region_id     uuid REFERENCES regions(id) ON DELETE SET NULL,
  start_at      timestamptz,
  end_at        timestamptz,
  sort_order    integer NOT NULL DEFAULT 0,
  -- 状态机：draft → pending → published / rejected，published ↔ offline
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'offline')),
  reject_reason text CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 200),
  created_by    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reviewed_by   uuid REFERENCES students(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  view_count    integer NOT NULL DEFAULT 0,
  click_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_time_window CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_promo_status_window ON promo_pages(status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_promo_region ON promo_pages(region_id);
CREATE INDEX IF NOT EXISTS idx_promo_sort ON promo_pages(sort_order, created_at DESC);

COMMENT ON TABLE promo_pages IS '启幕宣传页：启动时展示的正能量宣传内容，需审核后发布';
COMMENT ON COLUMN promo_pages.frequency IS 'once_per_launch=每次启动 / daily=每日一次 / once_per_content=同一内容仅一次';
COMMENT ON COLUMN promo_pages.region_id IS '归属区域；NULL 表示全校可见';

-- 仅后端 service_role 访问：开启 RLS 但不建策略 = 普通凭证一律拒绝
ALTER TABLE promo_pages ENABLE ROW LEVEL SECURITY;

-- 验证
-- select status, count(*) from promo_pages group by status;
