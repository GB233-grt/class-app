/**
 * /api/admin/regions —— 区域管理
 *   GET  —— 读取区域树：超级管理员看全部，教职工只看自己授权范围（含子孙）
 *   POST —— 新建区域（仅超级管理员）
 */
import { HttpError, jsonResponse, optionalString, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireStaff, requireSuperAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env, Region } from '../../../lib/types';

const REGION_TYPES = ['campus', 'grade', 'class', 'other'] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);

  const { data, error } = await createAdminClient(env)
    .from('regions')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }

  const rows = (data ?? []) as Region[];
  if (ctx.regionScope.isSuperAdmin) return jsonResponse(rows);

  const allowed = ctx.regionScope.regionSet ?? new Set<string>();
  return jsonResponse(rows.filter((region) => allowed.has(region.id)));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await requireSuperAdmin(env, request);

  const body = await readJson<Record<string, unknown>>(request);
  const name = requireString(body.name, '区域名称', { max: 40 });
  const rawType = optionalString(body.type, 20) ?? 'class';
  if (!REGION_TYPES.includes(rawType as (typeof REGION_TYPES)[number])) {
    throw new HttpError(400, '区域类型必须为 campus / grade / class / other');
  }
  const parentId = optionalString(body.parent_id, 40);

  if (parentId) {
    const { data: parent } = await createAdminClient(env)
      .from('regions')
      .select('id')
      .eq('id', parentId)
      .maybeSingle();
    if (!parent) throw new HttpError(404, '父级区域不存在');
  }

  const { data, error } = await createAdminClient(env)
    .from('regions')
    .insert({ name, type: rawType, parent_id: parentId })
    .select('*')
    .single();

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  return jsonResponse(data, 201);
};
