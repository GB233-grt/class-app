/**
 * POST /api/items/:id/status —— 上架 / 下架商品（管理员）
 *
 * 与 DELETE /api/items/:id 的区别：
 *   DELETE 是「删除」（软删除，is_active=false），语义上不可逆；
 *   本接口用于在「已上架 / 已下架」两个分组之间自由切换，可反复上架。
 *
 * 请求体：{ is_active: boolean }
 * 响应：{ id, name, is_active }
 */
import { HttpError, jsonResponse, readJson, translateDbError } from '../../../lib/http';
import { requireAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

interface StatusBody {
  is_active?: unknown;
}

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireAdmin(env, request);
  const id = String(params.id);

  const body = await readJson<StatusBody>(request);
  if (typeof body.is_active !== 'boolean') {
    throw new HttpError(400, 'is_active 必须为布尔值');
  }

  const { data, error } = await createAdminClient(env)
    .from('items')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .select('id, name, is_active')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  if (!data) {
    throw new HttpError(404, '商品不存在');
  }

  return jsonResponse(data);
};
