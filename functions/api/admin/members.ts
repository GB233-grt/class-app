/**
 * /api/admin/members —— 区域授权管理（仅超级管理员）
 *   GET    —— 列出所有「用户 ↔ 区域」授权
 *   POST   —— 给某用户授权某区域 { user_id, region_id }
 *   DELETE —— 取消授权 ?user_id=...&region_id=...
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../lib/http';
import { requireSuperAdmin } from '../../lib/auth';
import { createAdminClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireSuperAdmin(env, request);

  const { data, error } = await createAdminClient(env)
    .from('region_members')
    .select('user_id, region_id, created_at, students!user_id(name, email, role), regions!region_id(name, type)')
    .order('created_at', { ascending: true });

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data ?? []);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await requireSuperAdmin(env, request);

  const body = await readJson<Record<string, unknown>>(request);
  const userId = requireString(body.user_id, '用户 ID', { max: 40 });
  const regionId = requireString(body.region_id, '区域 ID', { max: 40 });

  const admin = createAdminClient(env);
  const { data: user } = await admin.from('students').select('id, role').eq('id', userId).maybeSingle();
  if (!user) throw new HttpError(404, '用户不存在');
  if ((user as { role: string }).role === 'student') {
    throw new HttpError(400, '学生账号不需要区域授权（学生通过所属区域归属）');
  }

  const { error } = await admin
    .from('region_members')
    .upsert({ user_id: userId, region_id: regionId }, { onConflict: 'user_id,region_id' });

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse({ user_id: userId, region_id: regionId }, 201);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  await requireSuperAdmin(env, request);

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const regionId = url.searchParams.get('region_id');
  if (!userId || !regionId) {
    throw new HttpError(400, '缺少 user_id 或 region_id');
  }

  const { error } = await createAdminClient(env)
    .from('region_members')
    .delete()
    .eq('user_id', userId)
    .eq('region_id', regionId);

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse({ message: '已取消授权' });
};
