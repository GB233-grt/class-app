/**
 * GET/PUT/DELETE /api/user —— 当前登录用户的资料（个人信息面板）
 *   GET  → 返回 students 表资料
 *   PUT  → 更新昵称/学号（是否允许由管理员在「系统设置」中控制）
 *   DELETE → 注销账号（需要旧密码二次确认，彻底清除账号与关联数据）
 */
import { HttpError, jsonResponse, optionalString, readJson, requireString, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createAdminClient, createAnonClient } from '../../lib/supabase';
import type { Env, Student } from '../../lib/types';

interface ProfileBody {
  name?: string;
  student_no?: string | null;
  old_password?: string;
}

/** 读取系统配置：是否允许学生自助修改个人信息 */
async function isProfileEditAllowed(env: Env): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient(env)
      .from('system_settings')
      .select('value')
      .eq('key', 'allow_profile_edit')
      .maybeSingle();
    // 配置缺失或表未创建时默认允许，避免影响正常使用
    if (error || !data) return true;
    const raw = typeof data.value === 'string' ? data.value : JSON.stringify(data.value ?? {});
    const parsed = JSON.parse(raw) as { enabled?: boolean };
    return parsed.enabled !== false;
  } catch {
    return true;
  }
}

// 获取当前用户资料
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  return jsonResponse(ctx.profile as Student);
};

// 更新当前用户资料（昵称 + 学号）
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  const body = await readJson<ProfileBody>(request);

  // 管理员可在系统设置中关闭自助修改
  const allowed = await isProfileEditAllowed(env);
  if (!allowed) {
    throw new HttpError(403, '管理员已关闭自助修改个人信息功能，请联系管理员');
  }

  // 只更新请求中出现的字段，避免漏传字段被置空
  const updates: { name?: string; student_no?: string | null } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    updates.name = requireString(body.name, '昵称', { max: 20 });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'student_no')) {
    updates.student_no = optionalString(body.student_no, 20);
  }
  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, '没有需要更新的内容');
  }

  const { data, error } = await createAdminClient(env)
    .from('students')
    .update(updates)
    .eq('id', ctx.userId)
    .select('name, student_no')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  if (!data) {
    throw new HttpError(404, '用户资料不存在');
  }
  return jsonResponse(data);
};

// 注销账号（带旧密码确认，操作不可逆）
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  const body = await readJson<ProfileBody>(request);
  const oldPassword = requireString(body.old_password, '确认密码');

  // 旧密码校验：用旧密码尝试登录一次，失败即拒绝（确保是本人操作）
  const anon = createAnonClient(env);
  const { error: verifyError } = await anon.auth.signInWithPassword({
    email: ctx.profile.email,
    password: oldPassword,
  });
  await anon.auth.signOut();
  if (verifyError) {
    throw new HttpError(401, '旧密码不正确');
  }

  // 动操作店店：先清学生表（外键 CASCADE 到兑换/积分明细），再清 Auth 账号
  const { error: studentError } = await createAdminClient(env)
    .from('students')
    .delete()
    .eq('id', ctx.userId);
  if (studentError) {
    throw new HttpError(500, translateDbError(studentError.message));
  }
  const { error: authError } = await createAdminClient(env).auth.admin.deleteUser(ctx.userId);
  if (authError) {
    throw new HttpError(500, translateDbError(authError.message));
  }
  return jsonResponse({ message: '账号已注销，所有数据已清除' });
};
