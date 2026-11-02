/**
 * /api/items
 *   GET  —— 获取商品列表（学生仅见上架商品，管理员可见全部）
 *   POST —— 添加商品（管理员）
 */
import {
  HttpError,
  jsonResponse,
  optionalString,
  readJson,
  requireInt,
  requireString,
  translateDbError,
} from '../../lib/http';
import { requireAdmin, requireAuth } from '../../lib/auth';
import { createAdminClient, createUserClient } from '../../lib/supabase';
import type { Env, Item } from '../../lib/types';

// 商品类型（实物商品 / 网络商品）
const ITEM_TYPES = ['physical', 'digital'] as const;

// 登录用户获取商品列表
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);

  const client = createUserClient(env, ctx.token);

  // 惰性清理：先把已到期的上架商品下架（失败不影响列表，例如迁移未执行）
  try {
    const { error: expireError } = await client.rpc('expire_items');
    if (expireError) {
      // 未执行 14_item_expiry.sql 时函数不存在，忽略即可
      console.warn('[items] expire_items 调用失败:', expireError.message);
    }
  } catch (err) {
    console.warn('[items] expire_items 调用异常:', err);
  }

  let query = client
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

// 管理员添加商品（实物商品的库存 / 网络商品的下载链接二选一）
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await requireAdmin(env, request);

  const body = await readJson<Record<string, unknown>>(request);
  const name = requireString(body.name, '商品名称', { max: 50 });
  const description = optionalString(body.description, 200);
  const cost = requireInt(body.cost, '积分价格', { min: 0, max: 1000000 });
  const stock = requireInt(body.stock, '库存', { min: 0, max: 1000000 });
  const imageUrl = optionalString(body.image_url, 500);

  // 商品类型
  const rawType = requireString(body.type, '商品类型');
  const type = ITEM_TYPES.find((t) => t === rawType);
  if (type === undefined) {
    throw new HttpError(400, '商品类型必须为 physical（实物商品）或 digital（网络商品）');
  }

  // 网络商品：下载链接必须提供，发布日期默认为现在
  const downloadUrl = optionalString(body.download_url, 500);
  const publishDate = optionalString(body.publish_date, 50);
  if (type === 'digital') {
    if (!downloadUrl) {
      throw new HttpError(400, '网络商品必须提供下载链接');
    }
  }

  // 下载次数限制（0=不限制）：空值或 0 表示不限制
  let downloadLimit = 0;
  if (
    body.download_limit !== undefined &&
    body.download_limit !== null &&
    body.download_limit !== ''
  ) {
    downloadLimit = requireInt(body.download_limit, '下载次数限制', { min: 0, max: 1000000 });
  }

  // 上架状态：默认直接上架；管理员也可以先建在「已下架」分组里待完善
  let isActive = true;
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      throw new HttpError(400, 'is_active 必须为布尔值');
    }
    isActive = body.is_active;
  }

  // 到期时间（可选）：留空表示永不过期
  let expiresAt: string | null = null;
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== '') {
    const raw = requireString(body.expires_at, '到期时间');
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, '到期时间格式不正确');
    }
    expiresAt = parsed.toISOString();
  }

  const { data, error } = await createAdminClient(env)
    .from('items')
    .insert({
      name,
      description,
      cost,
      stock,
      image_url: imageUrl,
      type,
      publish_date: publishDate || (type === 'digital' ? new Date().toISOString() : null),
      download_url: downloadUrl,
      download_limit: type === 'digital' ? downloadLimit : 0,
      is_active: isActive,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  return jsonResponse(data, 201);
};
