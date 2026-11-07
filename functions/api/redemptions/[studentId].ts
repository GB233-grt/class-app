/**
 * GET /api/redemptions/:studentId —— 获取兑换记录（本人或教职工）
 */
import { HttpError, jsonResponse } from '../../lib/http';
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

  const { data, error } = await createUserClient(env, ctx.token)
    .from('redemptions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new HttpError(500, '获取兑换记录失败');
  }
  return jsonResponse(data ?? []);
};
