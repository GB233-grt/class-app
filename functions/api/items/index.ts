/**
 * /api/items
 *   GET  —— 获取商品列表（学生仅见上架商品，管理员可见全部）
 *   POST —— 添加商品（管理员）
 */
import { HttpError, jsonResponse, optionalString, readJson, requireInt, requireString, translateDbError } from '../../lib/http';
import { requireAdmin, requireAuth } from '../../lib/auth';
import { createAdminClient, createUserClient } from '../../lib/supabase';
import type { Env, Item } from '../../lib/types';

// 登录用户获取商品列表
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);

  let query = createUserClient(env, ctx.token)
    .from('items')
    .select('*')
    .order('cost', { ascending: true })
    .order('created_at', { ascending: false });

  // 学生只看上架商品；管理员在管理后台需要看到全部（含已下架）
  if (!ctx.isAdmin) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(500, '获取商品列表失败');
  }
  return jsonResponse((data ?? []) as Item[]);
};

// 管理员添加商品
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await requireAdmin(env, request);

  const body = await readJson<Record<string, unknown>>(request);
  const name = requireString(body.name, '商品名称', { max: 50 });
  const description = optionalString(body.description, 200);
  const cost = requireInt(body.cost, '积分价格', { min: 1, max: 1000000 });
  const stock = requireInt(body.stock, '库存', { min: 0, max: 1000000 });
  const imageUrl = optionalString(body.image_url, 500);

  const { data, error } = await createAdminClient(env)
    .from('items')
    .insert({ name, description, cost, stock, image_url: imageUrl })
    .select('*')
    .single();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  return jsonResponse(data, 201);
};
