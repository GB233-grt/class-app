/**
 * POST /api/auth/reset-password —— 发送密码重置邮件
 * 经后端代理，避免前端直连 supabase.co
 */
import { HttpError, jsonResponse, readJson, requireString } from '../../lib/http';
import { createAnonClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

interface ResetBody {
  email?: string;
  redirect_to?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<ResetBody>(request);
  const email = requireString(body.email, '邮箱', { max: 100 }).toLowerCase();
  const redirectTo =
    typeof body.redirect_to === 'string' && /^https?:\/\//.test(body.redirect_to)
      ? body.redirect_to
      : undefined;

  const supabase = createAnonClient(env);
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : {},
  );
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('rate limit') || msg.includes('Too many')) {
      throw new HttpError(429, '发送过于频繁，请稍后再试');
    }
    throw new HttpError(400, '重置邮件发送失败，请确认邮箱地址是否正确');
  }
  return jsonResponse({ success: true });
};
