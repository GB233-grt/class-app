-- ============================================================
-- 17_fix_rls_for_super_admin.sql —— 修复超级管理员被 RLS 挡住
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 问题现象：
--   数据库里明明有几十个学生，超级管理员登录后「学生管理」只看到自己一行，
--   兑换记录、积分明细也几乎空白。
--
-- 根因：
--   15 号迁移把角色扩展成了 super_admin，但 RLS 的判定函数还是老逻辑：
--       is_current_admin()  → role = 'admin'
--       is_current_staff()  → role IN ('teacher','admin')
--   超级管理员不满足这两个条件，于是 students / redemptions / points_ledger
--   的 SELECT 策略全部不命中，只能看到 id = auth.uid() 的自己那一行。
--
-- 本脚本：把两个函数改成同时认 super_admin，其余逻辑不变。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 管理员判定：admin + super_admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_current_admin() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
     WHERE id = auth.uid()
       AND role IN ('admin', 'super_admin')
  );
$$;

-- ------------------------------------------------------------
-- 2. 教职工判定：teacher + admin + super_admin
--    （adjust_student_points / 批量加分 / 发放状态流转都依赖它）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_current_staff() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
     WHERE id = auth.uid()
       AND role IN ('teacher', 'admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION is_current_admin() FROM public, anon;
REVOKE ALL ON FUNCTION is_current_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION is_current_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_staff() TO authenticated;

-- ------------------------------------------------------------
-- 3. 检查：未分配区域的学生（区域为空时，区域管理员看不到）
-- ------------------------------------------------------------
-- select count(*) as 未分区学生 from students where region_id is null and role = 'student';

-- 如需把未分区学生统一挂到某个区域，先查出区域 ID 再执行：
-- update students
--    set region_id = '<区域 UUID>'
--  where region_id is null and role = 'student';

-- ------------------------------------------------------------
-- 4. 验证（以超级管理员身份执行应能看到全部学生）
-- ------------------------------------------------------------
-- select role, count(*) from students group by role;
-- select count(*) from students;              -- 期望：全部人数，而不是 1
-- select is_current_admin(), is_current_staff();
