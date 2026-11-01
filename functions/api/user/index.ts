/**
 * GET/PUT/DELETE /api/user —— 当前登录用户的资料（个人信息面板）
 *   GET  → 返回 students 表资料
 *   PUT  → 更新昵称/学号（所有登录用户均可修改自己的资料）
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

// 获取当前用户资料
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  return jsonResponse(ctx.profile as Student);
};

// 更新当前用户资料（昵称 + 学号）
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  const body = await readJson<ProfileBody>(request);

  const name = optionalString(body.name, 20);
  const studentNo = optionalString(body.student_no, 20);

  const { data, error } = await createAdminClient(env)
    .from('students')
    .update({ name, student_no: studentNo })
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
