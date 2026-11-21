-- ============================================================
-- 21_easter_egg_videos.sql —— 经审核的校园主题视频目录
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 隐形标签只作为教师内部备注，不触发任何学生端内容或视频。
-- 学生须自行打开 easter_egg_opt_in，并主动选择目录中的已审核视频。
-- ============================================================

CREATE TABLE IF NOT EXISTS easter_egg_videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  bvid        text NOT NULL CHECK (bvid ~ '^BV[0-9A-Za-z]{10}$'),
  category    text NOT NULL DEFAULT 'campus' CHECK (category IN ('campus', 'study', 'culture', 'other')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES students(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easter_egg_videos_public
  ON easter_egg_videos(status, is_active, sort_order);

ALTER TABLE easter_egg_videos ENABLE ROW LEVEL SECURITY;
-- 普通用户不能直接读写目录；后台仅由服务端 service_role 管理。

COMMENT ON TABLE easter_egg_videos IS '经学校审核的校园主题视频白名单；学生自愿选择后手动播放';

-- 测试内容需管理员在后台录入并审核，不在迁移中预置外部视频。
