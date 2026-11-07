/**
 * PUT /api/admin/users/:id/role —— 修改用户角色（仅超级管理员）
 *
 * 保护规则：
 *   · 不能把系统里最后一个超级管理员降级（否则没人能再配置权限）
 *   · 不能修改自己的角色（避免误操作把自己锁在外面）
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../../../lib/http';
import { requireSuperAdmin } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase';
import type { Env } from '../../../../lib/types';

const ROLES = ['student', 'teacher', 'admin', 'super_admin'] as const;

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireSuperAdmin(env, request);
  const targetId = String(params.id);

  if (targetId === ctx.userId) {
    throw new HttpError(400, '不能修改自己的角色');
  }

  const body = await readJson<Record<string, unknown>>(request);
  const role = requireString(body.role, '角色', { max: 20 });
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    throw new HttpError(400, '角色必须为 student / teacher / admin / super_admin');
  }

  const admin = createAdminClient(env);

  const { data: target, error: targetError } = await admin
    .from('students')
    .select('id, role')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError) throw new HttpError(500, '读取用户失败');
  if (!target) throw new HttpError(404, '用户不存在');

  // 最后一个超管不能降级
  if ((target as { role: string }).role === 'super_admin' && role !== 'super_admin') {
    const { count } = await admin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    if ((count ?? 0) <= 1) {
      throw new HttpError(400, '系统必须保留至少一名超级管理员');
    }
  }

  const { data, error } = await admin
    .from('students')
    .update({ role })
    .eq('id', targetId)
    .select('*')
    .single();

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data);
};
