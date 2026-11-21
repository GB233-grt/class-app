-- ============================================================
-- 20_student_tags.sql —— 学生公开标签 / 隐形标签 / 自愿视频彩蛋偏好
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 安全约束：
--   · public_tags：公开个人标签，可展示在学生界面
--   · hidden_tags：仅教师/管理员管理接口使用，绝不从学生端 API 返回
--   · easter_egg_opt_in：学生本人明确开启才允许显示可选校园视频；默认关闭
--   · easter_egg_video_id：仅引用管理员审核通过的视频，不接受任意 B 站 BV 号
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS public_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hidden_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS easter_egg_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS easter_egg_video_id text;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_public_tags_count_check,
  DROP CONSTRAINT IF EXISTS students_hidden_tags_count_check,
  DROP CONSTRAINT IF EXISTS students_tags_no_empty_check,
  DROP CONSTRAINT IF EXISTS students_easter_egg_bvid_check;

ALTER TABLE students
  ADD CONSTRAINT students_public_tags_count_check CHECK (cardinality(public_tags) <= 8),
  ADD CONSTRAINT students_hidden_tags_count_check CHECK (cardinality(hidden_tags) <= 8),
  ADD CONSTRAINT students_tags_no_empty_check
    CHECK (array_position(public_tags, '') IS NULL AND array_position(hidden_tags, '') IS NULL),
  ADD CONSTRAINT students_easter_egg_bvid_check
    CHECK (easter_egg_video_id IS NULL OR easter_egg_video_id ~ '^BV[0-9A-Za-z]{10}$');

COMMENT ON COLUMN students.public_tags IS '学生公开标签（最多 8 个），可在学生端个人资料展示';
COMMENT ON COLUMN students.hidden_tags IS '教师/管理员内部标签（最多 8 个），不得返回普通学生 API';
COMMENT ON COLUMN students.easter_egg_opt_in IS '学生自愿开启校园视频彩蛋；默认关闭';
COMMENT ON COLUMN students.easter_egg_video_id IS '引用经管理员审核的视频 BV 号；仅 opt-in 后可下发';

-- RLS 保持现有策略：学生不能直接更新这些字段；写入只经后端受权限检查的接口。
