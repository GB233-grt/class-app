/**
 * POST /api/auth/refresh —— 用刷新令牌换取新的访问令牌
 * 前端不直连 supabase.co：令牌刷新统一经此接口在服务端完成
 */
import { HttpError, jsonResponse, readJson, requireString } from '../../lib/http';
import type { Env } from '../../lib/types';

interface RefreshBody {
  refresh_token?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError(500, '服务端缺少 Supabase 配置');
  }

  const body = await readJson<RefreshBody>(request);
  const refreshToken = requireString(body.refresh_token, '刷新令牌', { max: 512 });

  let resp: Response;
  try {
    resp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${refreshToken}`,
      },
      body: '{}',
    });
  } catch {
    throw new HttpError(502, '认证服务暂时不可达，请稍后重试');
  }

  if (!resp.ok) {
    throw new HttpError(401, '登录已过期，请重新登录');
  }

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new HttpError(500, '认证服务返回的会话数据无效');
  }

  return jsonResponse({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? 0,
  });
};
