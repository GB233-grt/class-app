/**
 * DELETE /api/items/:id —— 删除商品（管理员）
 * 采用软删除：将商品下架（is_active = false），
 * 保留历史兑换记录的商品关联（redemptions.item_id 外键为 RESTRICT）。
 */
import { HttpError, jsonResponse } from '../../lib/http';
import { requireAdmin } from '../../lib/auth';
import { createAdminClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireAdmin(env, request);

  const id = String(params.id);
  const { data, error } = await createAdminClient(env)
    .from('items')
    .update({ is_active: false })
    .eq('id', id)
    .select('id, name, is_active')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, '删除商品失败');
  }
  if (!data) {
    throw new HttpError(404, '商品不存在');
  }
  return jsonResponse({ message: '商品已删除（下架）', item: data });
};
