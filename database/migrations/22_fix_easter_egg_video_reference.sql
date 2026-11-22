-- ============================================================
-- 22_fix_easter_egg_video_reference.sql —— 学生视频偏好改为引用视频目录 ID
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 根因：
--   学生设置实际保存的是 easter_egg_videos.id（UUID），但迁移 20 的 CHECK
--   错误地按 B 站 BV 号格式校验，导致 PostgreSQL 返回 check constraint violation。
--
-- 修复：移除 BV 格式约束，改为外键引用 easter_egg_videos(id)。
-- 旧值如果不是已存在的视频目录 ID，会清空为 NULL，避免迁移失败。
-- ============================================================

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_easter_egg_bvid_check;

-- 清理此前保存的非目录 ID 值（例如旧版直接存储的 BV 号）
UPDATE students s
   SET easter_egg_video_id = NULL
 WHERE s.easter_egg_video_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM easter_egg_videos v WHERE v.id::text = s.easter_egg_video_id
   );

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_easter_egg_video_id_fkey;

ALTER TABLE students
  ADD CONSTRAINT students_easter_egg_video_id_fkey
  FOREIGN KEY (easter_egg_video_id)
  REFERENCES easter_egg_videos(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN students.easter_egg_video_id IS '学生自愿选择的审核视频目录 ID（easter_egg_videos.id）';

-- 验证：字段值为空或是 easter_egg_videos.id
-- SELECT s.id, s.name, s.easter_egg_video_id, v.title
-- FROM students s LEFT JOIN easter_egg_videos v ON v.id::text = s.easter_egg_video_id
-- WHERE s.easter_egg_video_id IS NOT NULL;
