-- ============================================================
-- 22_fix_easter_egg_video_reference.sql —— 学生视频偏好改为 UUID 外键
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 根因：
--   20 号迁移把 students.easter_egg_video_id 建成 text，并按 BV 号校验；
--   实际前端保存的是 easter_egg_videos.id（uuid）。
--   直接加外键会因 text/uuid 类型不一致而报 42804。
--
-- 修复：
--   1. 删除旧 BV 号 CHECK / 可能的旧 FK
--   2. 只保留确实存在于 easter_egg_videos 的 ID，其余置 NULL
--   3. 将列从 text 安全转换为 uuid
--   4. 添加 UUID 外键
--
-- 可重复执行。未执行过 21 号迁移时，会明确报错，需先执行 21。
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.easter_egg_videos') IS NULL THEN
    RAISE EXCEPTION '找不到 easter_egg_videos：请先执行 database/migrations/21_easter_egg_videos.sql';
  END IF;
END;
$$;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_easter_egg_bvid_check;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_easter_egg_video_id_fkey;

-- 清掉旧 BV 字符串、格式错误的 UUID，以及目录中已不存在的视频 ID。
-- 在 UUID 转换前只保留能与实际视频目录 ID 匹配的文本值。
UPDATE public.students AS s
   SET easter_egg_video_id = NULL
 WHERE s.easter_egg_video_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.easter_egg_videos AS v
      WHERE v.id::text = s.easter_egg_video_id
   );

-- 现有列由迁移 20 创建为 text；清理后安全转换为 uuid。
ALTER TABLE public.students
  ALTER COLUMN easter_egg_video_id TYPE uuid
  USING NULLIF(easter_egg_video_id, '')::uuid;

ALTER TABLE public.students
  ADD CONSTRAINT students_easter_egg_video_id_fkey
  FOREIGN KEY (easter_egg_video_id)
  REFERENCES public.easter_egg_videos(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.students.easter_egg_video_id
  IS '学生自愿选择的审核视频目录 ID（easter_egg_videos.id）';

-- 验证：udt_name 应为 uuid；若存在值，应能关联到视频标题。
-- SELECT column_name, udt_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'students'
--   AND column_name = 'easter_egg_video_id';
--
-- SELECT s.name, s.easter_egg_video_id, v.title
-- FROM public.students AS s
-- LEFT JOIN public.easter_egg_videos AS v ON v.id = s.easter_egg_video_id
-- WHERE s.easter_egg_video_id IS NOT NULL;
