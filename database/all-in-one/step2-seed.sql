-- ============================================================
-- 积分商城 · 数据库一键初始化（第 2 步：种子数据）
-- 【执行前提】必须先完成两件事：
--   1. 已成功执行 step1-schema.sql
--   2. 已在 Supabase 控制台 → Authentication → Users → Add user
--      手动创建以下账号（勾选 Auto Confirm User，密码自定）：
--        admin@school.edu     （管理员）
--        teacher@school.edu   （教师）
--        student@school.edu   （学生）
--        student2@school.edu  （学生）
-- 使用方法：SQL Editor → New query → 粘贴本文件全部内容 → Run
-- 说明：脚本通过邮箱自动关联 Auth 用户 ID；可自由修改后执行；
--       重复执行无害（ON CONFLICT / 相同数据）
-- ============================================================

-- ============================================================
-- 第 1 部分：管理员记录
-- ============================================================
INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '管理员', NULL, 'admin@school.edu', 'admin', 0
FROM auth.users u
WHERE u.email = 'admin@school.edu'
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 第 2 部分：教师记录
-- ============================================================
INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '教师', NULL, 'teacher@school.edu', 'teacher', 0
FROM auth.users u
WHERE u.email = 'teacher@school.edu'
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 第 3 部分：示例学生记录
-- ============================================================
INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '学生用户', 'S2024001', 'student@school.edu', 'student', 250
FROM auth.users u
WHERE u.email = 'student@school.edu'
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, name, student_no, email, role, points)
SELECT u.id, '示例学生2', 'S2024002', 'student2@school.edu', 'student', 100
FROM auth.users u
WHERE u.email = 'student2@school.edu'
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 第 4 部分：示例商品（物品）数据 —— 可自由修改
-- ============================================================
INSERT INTO items (name, description, cost, stock, image_url) VALUES
  ('学校笔记本',     'A5硬壳笔记本，120页',        30,  50,  NULL),
  ('中性笔套装',     '5支蓝色中性笔装',            15,  100, NULL),
  ('保温水瓶',       '750ml不锈钢保温瓶带校徽',    80,  20,  NULL),
  ('帆布托特包',     '环保帆布包印校徽',           60,  30,  NULL),
  ('科学计算器',     '卡西欧FX-991EX',             200, 8,   NULL),
  ('图书馆通行证',   '全天优先自习室使用权',       25,  999, NULL),
  ('无线耳机',       '蓝牙耳机带充电盒',           300, 5,   NULL),
  ('电影票兑换券',   '单次影院兑换券',             120, 15,  NULL);
