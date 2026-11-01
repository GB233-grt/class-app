-- ============================================================
-- 10_system_settings.sql —— 系统配置表
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 内容：
--   1. 新建系统配置表 system_settings（键值对，值为 JSON 字符串）
--   2. 开启 RLS：所有人可读、仅管理员可写
--   3. 写入默认配置：允许学生自助修改个人信息（昵称 / 学号）
--
-- 说明：后端 /api/admin/system-settings 与 /api/user/system-settings
--       均使用 service role 访问，此表的 RLS 主要防止前端直连越权写入。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  -- 配置键名（唯一）
  key         text PRIMARY KEY CHECK (key <> ''),
  -- 配置值（JSON 字符串，例如 '{"enabled":true}'）
  value       text NOT NULL DEFAULT '{}',
  -- 配置说明
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.system_settings             IS '系统级配置（键值对）';
COMMENT ON COLUMN public.system_settings.key         IS '配置键名';
COMMENT ON COLUMN public.system_settings.value       IS '配置值（JSON 字符串）';
COMMENT ON COLUMN public.system_settings.description IS '配置说明';

-- ------------------------------------------------------------
-- RLS：所有人可读，仅管理员可写（is_current_admin 定义于 06_enable_rls.sql）
-- ------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "系统配置：所有登录用户可读" ON public.system_settings;
CREATE POLICY "系统配置：所有登录用户可读"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "系统配置：仅管理员可写" ON public.system_settings;
CREATE POLICY "系统配置：仅管理员可写"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (is_current_admin())
  WITH CHECK (is_current_admin());

-- ------------------------------------------------------------
-- 默认配置
--   allow_profile_edit：是否允许学生/教师自助修改昵称、学号
--   默认【关闭】：学生无法自助修改，需由管理员在「系统设置」中开启，
--                 或在「学生管理」中代为调整
-- ------------------------------------------------------------
INSERT INTO public.system_settings (key, value, description)
VALUES ('allow_profile_edit', '{"enabled": false}', '是否允许学生自助修改个人信息（昵称 / 学号），默认关闭')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 验证
-- ------------------------------------------------------------
-- SELECT * FROM public.system_settings;
