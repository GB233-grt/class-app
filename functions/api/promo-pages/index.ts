/**
 * /api/promo-pages —— 启幕宣传页管理
 *   GET  —— 列表（教师+，按区域裁剪，分页）
 *   POST —— 新建草稿（教师+，仅限自己的授权区域）
 *
 * 权限模型：
 *   · 教师：创建/编辑草稿并提交审核
 *   · 管理员：审核、发布、下线（区域管理员仅限授权区域）
 *   · 超级管理员：不受区域限制
 */
import {
  HttpError,
  jsonResponse,
 
  parsePagination,
  pagedResponse,
  readJson,
 
  translateDbError,
} from '../../lib/http';
import { requireStaff } from '../../lib/auth';
import { assertRegionAllowed } from '../../lib/rbac';
import { parsePromoBody } from '../../lib/promoBody';
import { createAdminClient } from '../../lib/supabase';
import type { Env, PromoPage } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url, 20);
  const status = url.searchParams.get('status');

  let query = createAdminClient(env)
    .from('promo_pages')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);

  if (status) query = query.eq('status', status);

  if (!ctx.regionScope.isSuperAdmin) {
    const allowed = ctx.regionScope.regionIds ?? [];
    if (allowed.length === 0) return jsonResponse({ items: [], has_more: false });
    // 区域内的内容 + 全校内容（region_id 为空）
    query = query.or(`region_id.is.null,region_id.in.(${allowed.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new HttpError(500, translateDbError(error.message));

  const rows = (data ?? []) as PromoPage[];
  return pagedResponse(rows.slice(0, limit), rows.length > limit);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);
  const body = await readJson<Record<string, unknown>>(request);
  const fields = parsePromoBody(body, env);

  // 区域：未指定时，若只有唯一授权区域则自动归属
  let regionId = (fields.region_id as string | null) ?? null;
  if (!regionId && !ctx.regionScope.isSuperAdmin && (ctx.regionScope.regionIds ?? []).length === 1) {
    regionId = (ctx.regionScope.regionIds as string[])[0];
  }
  if (regionId) assertRegionAllowed(ctx.regionScope, regionId);

  const admin = createAdminClient(env);
  const { data, error } = await admin
    .from('promo_pages')
    .insert({
      title: fields.title,
      body: fields.body,
      image_url: fields.image_url ?? null,
      link_url: fields.link_url ?? null,
      link_label: fields.link_label ?? null,
      frequency: fields.frequency ?? 'daily',
      audience: fields.audience ?? 'all',
      region_id: regionId,
      start_at: fields.start_at ?? null,
      end_at: fields.end_at ?? null,
      sort_order: fields.sort_order ?? 0,
      status: 'draft',
      created_by: ctx.userId,
    })
    .select('*')
    .single();

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data, 201);
};
