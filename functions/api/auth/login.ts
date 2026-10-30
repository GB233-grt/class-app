/**
 * POST /api/auth/login —— 用户登录
 * 流程：校验 Cloudflare Turnstile 人机验证令牌（若启用）→ Supabase Auth 密码登录 → 返回会话
 *
 * Turnstile 说明：
 *   - 前端挂件验证成功后携带一次性 token（cf_turnstile_token）请求本接口
 *   - 本接口用服务端密钥调用 Cloudflare siteverify 校验该 token，
 *     未配置 TURNSTILE_SECRET_KEY 时跳过（站点保持可用，不强制验证）
 */
import { HttpError, jsonResponse, readJson, requireString } from '../../lib/http';
import { createAnonClient } from '../../lib/supabase';

import type { Env } from '../../lib/types';

interface LoginBody {
  email?: string;
  password?: string;
  cf_turnstile_token?: string;
}

/**
 * 校验 Turnstile token：只能使用一次，且必须由服务端验证，前端无法伪造
 * siteverify 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
async function verifyTurnstile(env: Env, request: Request, token: string | null): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) {
    // 未配置密钥 = 不启用人机验证（便于部署期过渡与本地调试）
    return;
  }
  if (!token) {
    throw new HttpError(403, '请先完成人机验证');
  }

  const form = new URLSearchParams();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) {
    form.append('remoteip', clientIp);
  }

  let result: { success?: boolean };
  try {
    const verify = await fetch('https://challenges.cloudflare.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!verify.ok) {
      throw new HttpError(500, '人机验证服务暂时不可用，请稍后重试');
    }
    result = (await verify.json()) as { success?: boolean };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, '人机验证服务暂时不可用，请稍后重试');
  }

  if (!result.success) {
    throw new HttpError(403, '人机验证失败，请刷新页面后重试');
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<LoginBody>(request);
  const email = requireString(body.email, '邮箱', { max: 100 }).toLowerCase();
  const password = requireString(body.password, '密码', { max: 72 });

  // 先校验人机验证（失败即拒绝，不消耗 Supabase 登录配额）
  await verifyTurnstile(env, request, body.cf_turnstile_token ?? null);

  const supabase = createAnonClient(env);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new HttpError(401, '邮箱或密码错误');
  }

  return jsonResponse({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
};
