-- ============================================================
-- 02_create_students.sql —— 创建示例学生记录（模板，不自动执行）
--
-- 使用前提：
--   1. 已在 Supabase 控制台执行 database/migrations/ 下的全部建表脚本；
--   2. 已在 Supabase 控制台 → Authentication → Users 中手动创建学生账号，
--      邮箱需与下方 SQL 中的邮箱一致，密码自行设置。
--
-- 说明：本脚本通过邮箱自动关联 auth.users 中的用户 ID；
--       用户可自行增删改示例数据后再执行。
-- ============================================================

-- 示例学生 1
INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '学生用户', 'S2024001', 'student@school.edu', 'student', 250
FROM auth.users u
WHERE u.email = 'student@school.edu'
ON CONFLICT (id) DO NOTHING;

-- 示例学生 2
INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '示例学生2', 'S2024002', 'student2@school.edu', 'student', 100
FROM auth.users u
WHERE u.email = 'student2@school.edu'
ON CONFLICT (id) DO NOTHING;
