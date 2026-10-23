/**
 * POST /api/auth/login —— 用户登录
 * 说明：前端通常直接使用 Supabase Auth SDK 登录（保持会话管理一致），
 *       此接口保留给第三方客户端或脚本调用的场景。
 */
import { HttpError, jsonResponse, readJson, requireString } from '../../lib/http';
import { createAnonClient } from '../../lib/supabase';

import type { Env } from '../../lib/types';

interface LoginBody {
  email?: string;
  password?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<LoginBody>(request);
  const email = requireString(body.email, '邮箱', { max: 100 }).toLowerCase();
  const password = requireString(body.password, '密码', { max: 72 });

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
