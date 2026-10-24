/**
 * POST /api/auth/logout —— 登出
 * 服务端尽力吊销访问令牌（失败不影响本地登出），前端随后清除本地会话
 */
import { jsonResponse } from '../../lib/http';
import type { Env } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (token && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    try {
      await fetch(`${env.SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // 吊销失败不阻断登出流程
    }
  }

  return jsonResponse({ success: true });
};
