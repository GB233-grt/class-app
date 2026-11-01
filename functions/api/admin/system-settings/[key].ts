/**
 * GET /api/admin/system-settings/:key —— 获取指定配置
 * 仅管理员可访问
 */
import { HttpError, jsonResponse } from '../../../lib/http';
import { requireAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

export const onRequestGet: PagesFunction<Env, 'key'> = async ({ params, request, env }) => {
  await requireAdmin(env, request);
  const key = String(params.key);

  const { data, error } = await createAdminClient(env)
    .from('system_settings')
    .select('key, value, description, created_at, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, '获取配置失败');
  }
  if (!data) {
    throw new HttpError(404, '配置不存在');
  }
  return jsonResponse(data);
};
