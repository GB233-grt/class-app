/**
 * /api/items/:id
 *   PUT    —— 编辑商品（管理员）：名称、描述、积分价格、库存、图片URL、
 *            商品类型（实物/网络商品）及网络商品的下载链接等
 *   DELETE —— 删除商品（管理员）：软删除下架（is_active = false），
 *             保留历史兑换记录的商品关联（redemptions.item_id 外键为 RESTRICT）
 */
import { HttpError, jsonResponse, optionalString, readJson, requireInt, requireString, translateDbError } from '../../lib/http';
import { requireAdmin } from '../../lib/auth';
import { createAdminClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

// 商品类型（实物商品 / 网络商品）
const ITEM_TYPES = ['physical', 'digital'] as const;

// 管理员编辑商品（已上架 / 已下架均可编辑，便于调整库存或价格）
export const onRequestPut: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireAdmin(env, request);
  const id = String(params.id);

  const body = await readJson<Record<string, unknown>>(request);
  const name = requireString(body.name, '商品名称', { max: 50 });
  const description = optionalString(body.description, 200);
  const cost = requireInt(body.cost, '积分价格', { min: 1, max: 1000000 });
  const stock = requireInt(body.stock, '库存', { min: 0, max: 1000000 });
  const imageUrl = optionalString(body.image_url, 500);

  // 商品类型
  const rawType = body.type === undefined ? undefined : requireString(body.type, '商品类型');
  const type = rawType === undefined ? undefined : ITEM_TYPES.find((t) => t === rawType);
  if (type !== undefined && type !== 'physical' && type !== 'digital') {
    throw new HttpError(400, '商品类型必须为 physical（实物商品）或 digital（网络商品）');
  }

  // 网络商品：下载链接必须提供
  const downloadUrl = body.download_url === undefined ? undefined : optionalString(body.download_url, 500);
  const publishDate = body.publish_date === undefined ? undefined : optionalString(body.publish_date, 50);
  if (type === 'digital' && !downloadUrl) {
    throw new HttpError(400, '网络商品必须提供下载链接');
  }

  // 下载次数限制（0=不限制）
  const downloadLimit = body.download_limit === undefined ? undefined : requireInt(body.download_limit, '下载次数限制', { min: 0, max: 1000000 });

  const update: Record<string, unknown> = { name, description, cost, stock, image_url: imageUrl };
  if (type) update.type = type;
  if (publishDate) update.publish_date = publishDate;
  if (downloadUrl) update.download_url = downloadUrl;
  if (downloadLimit !== undefined) update.download_limit = downloadLimit;

  const { data, error } = await createAdminClient(env)
    .from('items')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  if (!data) {
    throw new HttpError(404, '商品不存在');
  }
  return jsonResponse(data);
};

// 管理员删除商品（软删除下架）
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
