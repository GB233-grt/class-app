/**
 * POST /api/auth/change-password —— 修改登录密码
 * 流程（全部 LOT 校验）：
 *   1. 登录态校验（JWT），确保请求者即为本人
 *   2. 旧密码校验：用旧密码尝试一次 Supabase Auth 登录，失败 = 旧密码不正确
 *   3. 新密码强度校验：8 位以上 + 大小写 + 数字 + 特殊字符
 *   4. 写入新密码（Supabase Auth 负责加盐/哈希，不可逆）
 *
 * 注意：不依赖邮箱验证码（用户已在会话中），旧密码校验失败严格按 401 返回
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createAdminClient, createAnonClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

interface ChangePasswordBody {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/** 新密码强度规则 */
const PASSWORD_EXP = {
  /** 最小长度 */
  minLength: 8,
  /** 大写字母 */
  upper: /[A-Z]/,
  /** 小写字母 */
  lower: /[a-z]/,
  /** 数字 */
  digit: /[0-9]/,
  /** 特殊字符 */
  special: /[!@#$%^&*()_\-+=\[\]{};:'"\\|,.<>\/?~`]/,
};

function checkPasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_EXP.minLength) return `密码长度不能少于 ${PASSWORD_EXP.minLength} 位`;
  if (!PASSWORD_EXP.upper.test(password)) return '密码必须包含大写英文字母';
  if (!PASSWORD_EXP.lower.test(password)) return '密码必须包含小写英文字母';
  if (!PASSWORD_EXP.digit.test(password)) return '密码必须包含数字';
  if (!PASSWORD_EXP.special.test(password)) return '密码必须包含特殊字符（如 ! @ # $ %）';
  return null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1. 登录态凭据校验（JWT）
  const ctx = await requireAuth(env, request);
  const { old_password, new_password, confirm_password } = await readJson<ChangePasswordBody>(request);

  requireString(old_password, '旧密码');
  requireString(new_password, '新密码');
  requireString(confirm_password, '确认密码');

  // 2. 新密码强度校验
  const strengthError = checkPasswordStrength(new_password);
  if (strengthError) throw new HttpError(400, strengthError);

  if (new_password !== confirm_password) {
    throw new HttpError(400, '两次输入的新密码不一致');
  }
  if (new_password === old_password) {
    throw new HttpError(400, '新密码不能与旧密码相同');
  }

  // 3. 旧密码校验：用旧密码尝试一次登录，失败 = 旧密码不正确（不依赖注册邮箱）
  const anon = createAnonClient(env);
  const { error: verifyError } = await anon.auth.signInWithPassword({
    email: ctx.profile.email,
    password: old_password,
  });
  await anon.auth.signOut(); // 取消这次测试登录产生的临时会话
  if (verifyError) {
    throw new HttpError(401, '旧密码不正确');
  }

  // 4. 错误信息中文化：Supabase Auth 对密码更新的错误信息
  try {
    const client = createAdminClient(env);
    const { error } = await client.auth.admin.updateUserById(ctx.userId, { password: new_password });
    if (error) {
      throw new HttpError(500, translateDbError(error.message));
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : '修改密码失败，请稍后重试';
    throw new HttpError(500, translateDbError(msg) || msg);
  }

  return jsonResponse({ message: '密码修改成功' });
};
