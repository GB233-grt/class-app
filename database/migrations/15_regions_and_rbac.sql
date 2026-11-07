-- ============================================================
-- 15_regions_and_rbac.sql —— 区域隔离与超级管理员
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 权限模型（简单、可扩展）：
--   角色 role：
--     super_admin  超级管理员：全部区域 + 用户/角色/权限配置（不受区域限制）
--     admin        管理员：仅被授权区域（含其子孙区域）内的全部管理
--     teacher      教师：仅被授权区域（含其子孙区域）内的加分 / 发放
--     student      学生：只能看自己
--
--   区域 regions：树形结构（校区 → 年级 → 班级），用 parent_id 自关联
--   授权 region_members：教职工 ↔ 区域 多对多；授权到某个区域即自动获得其所有子孙区域
--
-- 判定链：用户 → region_members → 该区域及所有子孙 → 该范围内的学生
-- ============================================================

-- ------------------------------------------------------------
-- 1. 角色扩展
-- ------------------------------------------------------------
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_role_check;
ALTER TABLE students
  ADD CONSTRAINT students_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'super_admin'));

COMMENT ON COLUMN students.role IS '角色：student=学生 / teacher=教师 / admin=区域管理员 / super_admin=超级管理员';

-- ------------------------------------------------------------
-- 2. 区域表（树形）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (name <> ''),
  -- campus=校区 / grade=年级 / class=班级 / other=其他自定义层级
  type       text NOT NULL DEFAULT 'class' CHECK (type IN ('campus', 'grade', 'class', 'other')),
  parent_id  uuid REFERENCES regions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id);

COMMENT ON TABLE regions IS '区域：校区 / 年级 / 班级等树形组织结构';
COMMENT ON COLUMN regions.type IS 'campus=校区 grade=年级 class=班级 other=其他';

-- ------------------------------------------------------------
-- 3. 区域授权（教职工 ↔ 区域）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS region_members (
  user_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  region_id  uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_region_members_region ON region_members(region_id);

COMMENT ON TABLE region_members IS '教职工的区域授权：授权某区域即自动覆盖其所有子孙区域';

-- ------------------------------------------------------------
-- 4. 学生归属区域
-- ------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_region ON students(region_id);

COMMENT ON COLUMN students.region_id IS '所属区域（学生用）；为空表示未分区，仅超级管理员可见';

-- ------------------------------------------------------------
-- 5. 兼容存量数据
-- ------------------------------------------------------------
-- 5.1 建一个默认区域，把现有学生（以及教师/管理员）都放进去
INSERT INTO regions (id, name, type, parent_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, '全校', 'campus', NULL
WHERE NOT EXISTS (SELECT 1 FROM regions);

UPDATE students
   SET region_id = '00000000-0000-0000-0000-000000000001'::uuid
 WHERE region_id IS NULL
   AND role IN ('student', 'teacher');

-- 5.2 现有管理员授权到「全校」，避免升级后立刻看不到人
INSERT INTO region_members (user_id, region_id)
SELECT s.id, '00000000-0000-0000-0000-000000000001'::uuid
  FROM students s
 WHERE s.role = 'admin'
ON CONFLICT DO NOTHING;

-- 5.3 提升最早创建的管理员为超级管理员，保证系统里始终有人能配置权限
UPDATE students
   SET role = 'super_admin'
 WHERE id = (
   SELECT id FROM students
    WHERE role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1
 );

-- 如果库里一个管理员都没有，把最早创建的教师提为超级管理员作为兜底
UPDATE students
   SET role = 'super_admin'
 WHERE NOT EXISTS (SELECT 1 FROM students WHERE role = 'super_admin')
   AND id = (
     SELECT id FROM students
      WHERE role = 'teacher'
      ORDER BY created_at ASC
      LIMIT 1
   );

-- ------------------------------------------------------------
-- 6. 权限判断辅助函数
-- ------------------------------------------------------------

-- 是否超级管理员
CREATE OR REPLACE FUNCTION is_current_super_admin() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM students WHERE id = auth.uid() AND role = 'super_admin');
$$;

-- 当前用户的「有效区域集合」：被授权区域 + 其全部子孙区域
-- 超级管理员不受限（本函数对超管仍返回其显式授权，业务层需额外短路由）
CREATE OR REPLACE FUNCTION current_user_region_ids() RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE seeds AS (
    SELECT region_id FROM region_members WHERE user_id = auth.uid()
  ), tree AS (
    SELECT r.id FROM regions r JOIN seeds s ON s.region_id = r.id
    UNION
    SELECT r.id FROM regions r JOIN tree t ON r.parent_id = t.id
  )
  SELECT id FROM tree;
$$;

REVOKE ALL ON FUNCTION is_current_super_admin() FROM public, anon;
REVOKE ALL ON FUNCTION current_user_region_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION is_current_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_region_ids() TO authenticated;

-- ------------------------------------------------------------
-- 7. RLS（区域感知的读取策略）
-- ------------------------------------------------------------
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "区域：超级管理员可管理" ON regions;
CREATE POLICY "区域：超级管理员可管理"
  ON regions FOR ALL TO authenticated
  USING (is_current_super_admin())
  WITH CHECK (is_current_super_admin());

DROP POLICY IF EXISTS "区域：成员可读自己授权范围" ON regions;
CREATE POLICY "区域：成员可读自己授权范围"
  ON regions FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_region_ids()));

DROP POLICY IF EXISTS "区域授权：超级管理员可管理" ON region_members;
CREATE POLICY "区域授权：超级管理员可管理"
  ON region_members FOR ALL TO authenticated
  USING (is_current_super_admin())
  WITH CHECK (is_current_super_admin());

DROP POLICY IF EXISTS "区域授权：可读自己的授权" ON region_members;
CREATE POLICY "区域授权：可读自己的授权"
  ON region_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 验证
-- ------------------------------------------------------------
-- select role, count(*) from students group by role;
-- select * from regions;
-- select s.name, s.role, r.name as region from students s left join regions r on r.id = s.region_id;
