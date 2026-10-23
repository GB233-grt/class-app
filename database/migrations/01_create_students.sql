-- ============================================================
-- 01_create_students.sql —— 学生表
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
-- ============================================================

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- 学生姓名
  student_no text UNIQUE,                      -- 学号（可选）
  email text UNIQUE NOT NULL,                  -- 邮箱（登录用）
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin')),      -- 角色：学生或管理员（预留扩展空间，便于未来添加"教师"等角色）
  points integer NOT NULL DEFAULT 0
    CHECK (points >= 0),                       -- 当前积分余额
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_role ON students(role);
