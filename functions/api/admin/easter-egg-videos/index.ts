/**
 * /api/admin/easter-egg-videos
 *   GET  —— 教师+查看授权范围视频；超级管理员看全部
 *   POST —— 教师提交待审核视频（只能指定自己的授权区域）
 *
 * 学生读取已审核目录使用 /api/student-easter-eggs，不会看到待审核/驳回项。
 */
import { HttpError, jsonResponse, optionalString, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireStaff } from '../../../lib/auth';
import { assertRegionAllowed } from '../../../lib/rbac';
import { createAdminClient } from '../../../lib/supabase';
import type { Env, EasterEggVideo } from '../../../lib/types';

const CATEGORIES = ['campus', 'study', 'culture', 'other'] as const;
const BV_PATTERN = /^BV[0-9A-Za-z]{10}$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let query = createAdminClient(env)
    .from('easter_egg_videos')
    .select('*, regions(name)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status);
  }
  if (!ctx.regionScope.isSuperAdmin) {
    const regionIds = ctx.regionScope.regionIds ?? [];
    if (regionIds.length === 0) return jsonResponse([]);
    query = query.in('region_id', regionIds);
  }

  const { data, error } = await query;
  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data ?? []);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);
  const body = await readJson<Record<string, unknown>>(request);
  const title = requireString(body.title, '视频标题', { max: 80 });
  const bvid = requireString(body.bvid, 'B 站 BV 号', { max: 12 });
  if (!BV_PATTERN.test(bvid)) throw new HttpError(400, 'BV 号格式不正确');
  const description = optionalString(body.description, 300) ?? '';
  const rawCategory = optionalString(body.category, 20) ?? 'campus';
  if (!CATEGORIES.includes(rawCategory as (typeof CATEGORIES)[number])) {
    throw new HttpError(400, '视频分类不合法');
  }
  const regionId = optionalString(body.region_id, 40);
  if (!regionId && !ctx.isSuperAdmin) {
    const allowed = ctx.regionScope.regionIds ?? [];
    if (allowed.length !== 1) throw new HttpError(400, '请指定视频所属区域');
  }
  const resolvedRegion = regionId ?? ctx.regionScope.regionIds?.[0] ?? null;
  if (resolvedRegion) assertRegionAllowed(ctx.regionScope, resolvedRegion);

  const { data, error } = await createAdminClient(env)
    .from('easter_egg_videos')
    .insert({
      title,
      bvid,
      description,
      category: rawCategory,
      region_id: resolvedRegion,
      status: 'pending',
      is_active: true,
      created_by: ctx.userId,
    })
    .select('*')
    .single();
  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data as EasterEggVideo, 201);
};
