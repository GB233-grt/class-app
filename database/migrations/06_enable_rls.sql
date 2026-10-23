-- ============================================================
-- 06_enable_rls.sql —— 启用行级安全（RLS）
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
--
-- 安全模型：
--   * 所有业务读写均通过 Cloudflare Pages Functions 后端完成；
--     普通用户凭证只能"读自己的数据"，写操作要么走服务端
--     （SERVICE_ROLE 密钥，绕过 RLS），要么走安全函数（RPC）。
--   * is_current_admin() 为 SECURITY DEFINER 函数，
--     避免在 students 表策略中直接子查询自身导致递归。
-- ============================================================

ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- 判断当前登录用户是否为管理员
CREATE OR REPLACE FUNCTION is_current_admin() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 学生表：登录用户可查看自己的资料，管理员可查看全部；写入仅通过后端
CREATE POLICY "学生可查看自己的资料"
  ON students FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_current_admin());

-- 商品表：登录用户可查看（上架筛选由后端接口负责）；写入仅通过后端
CREATE POLICY "登录用户可查看商品"
  ON items FOR SELECT
  TO authenticated
  USING (true);

-- 兑换记录：本人或管理员可查看
CREATE POLICY "用户可查看自己的兑换记录"
  ON redemptions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_admin());

-- 积分明细：本人或管理员可查看
CREATE POLICY "用户可查看自己的积分明细"
  ON points_ledger FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR is_current_admin());

-- 提示：以上未创建 INSERT / UPDATE / DELETE 策略，
--       因此普通用户凭证无法直接改写数据，所有写操作必须通过后端 API。
