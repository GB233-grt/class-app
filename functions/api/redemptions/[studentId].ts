/**
 * GET /api/redemptions/:studentId —— 获取兑换记录（本人或教职工）
 * 分页：?limit=&offset=（默认 50，上限 100），返回 { items, has_more }
 */
import { HttpError, parsePagination, pagedResponse } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { assertStudentAllowed } from '../../lib/rbac';
import { createUserClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env, 'studentId'> = async ({ params, request, env }) => {
  const ctx = await requireAuth(env, request);
  const studentId = String(params.studentId);

  if (!ctx.isStaff && ctx.userId !== studentId) {
    throw new HttpError(403, '只能查看自己的兑换记录');
  }
  // 教职工查看他人记录时，必须落在自己的授权区域内
  if (ctx.isStaff && ctx.userId !== studentId && !ctx.isSuperAdmin) {
    await assertStudentAllowed(env, ctx.regionScope, studentId);
  }

  const { limit, offset } = parsePagination(new URL(request.url));
  // 多取一条用于判断是否还有下一页
  const { data, error } = await createUserClient(env, ctx.token)
    .from('redemptions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    throw new HttpError(500, '获取兑换记录失败');
  }

  const rows = data ?? [];
  return pagedResponse(rows.slice(0, limit), rows.length > limit);
};
