/**
 * /api/admin/regions/:id —— 编辑 / 删除区域（仅超级管理员）
 *   PUT    —— 改名、改类型、调整父级
 *   DELETE —— 删除（子区域级联删除，学生 region_id 置空）
 */
import { HttpError, jsonResponse, optionalString, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireSuperAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

const REGION_TYPES = ['campus', 'grade', 'class', 'other'] as const;

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireSuperAdmin(env, request);
  const id = String(params.id);

  const body = await readJson<Record<string, unknown>>(request);
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    update.name = requireString(body.name, '区域名称', { max: 40 });
  }
  if (body.type !== undefined) {
    const type = requireString(body.type, '区域类型', { max: 20 });
    if (!REGION_TYPES.includes(type as (typeof REGION_TYPES)[number])) {
      throw new HttpError(400, '区域类型必须为 campus / grade / class / other');
    }
    update.type = type;
  }
  if (body.parent_id !== undefined) {
    const parentId = optionalString(body.parent_id, 40);
    if (parentId === id) {
      throw new HttpError(400, '父级区域不能是自己');
    }
    update.parent_id = parentId;
  }

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, '没有需要更新的内容');
  }

  const { data, error } = await createAdminClient(env)
    .from('regions')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw new HttpError(500, translateDbError(error.message));
  if (!data) throw new HttpError(404, '区域不存在');
  return jsonResponse(data);
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireSuperAdmin(env, request);
  const id = String(params.id);

  // 有学生归属时禁止删除，避免把学生变成孤儿数据
  const { count, error: countError } = await createAdminClient(env)
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('region_id', id);

  if (countError) throw new HttpError(500, '检查区域下学生失败');
  if ((count ?? 0) > 0) {
    throw new HttpError(400, `该区域下还有 ${count} 个账号，请先转移后再删除`);
  }

  const { error } = await createAdminClient(env).from('regions').delete().eq('id', id);
  if (error) throw new HttpError(500, translateDbError(error.message));

  return jsonResponse({ message: '区域已删除' });
};
