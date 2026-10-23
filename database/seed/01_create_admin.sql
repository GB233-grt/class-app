-- ============================================================
-- 01_create_admin.sql —— 创建管理员记录（模板，不自动执行）
--
-- 使用前提：
--   1. 已在 Supabase 控制台执行 database/migrations/ 下的全部建表脚本；
--   2. 已在 Supabase 控制台 → Authentication → Users 中手动创建管理员账号，
--      邮箱需与下方 SQL 中的邮箱一致，密码自行设置。
--
-- 说明：本脚本通过邮箱自动关联 auth.users 中的用户 ID，
--       确保 students.id 与登录账号一一对应。
--       若执行后提示"0 rows affected"，请先创建对应邮箱的 Auth 用户。
-- ============================================================

INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '管理员', NULL, 'admin@school.edu', 'admin', 0
FROM auth.users u
WHERE u.email = 'admin@school.edu'
ON CONFLICT (id) DO NOTHING;

-- 备选写法（已知 Auth 用户 ID 时可直接填写）：
-- INSERT INTO students (id, name, student_no, email, role, points)
-- VALUES ('在此粘贴Auth用户ID', '管理员', NULL, 'admin@school.edu', 'admin', 0);
