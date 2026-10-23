/**
 * GET /api/auth/me —— 获取当前用户信息（students 表资料）
 */
import { jsonResponse } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  return jsonResponse(ctx.profile);
};
