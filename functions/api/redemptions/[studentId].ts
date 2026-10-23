/**
 * GET /api/redemptions/:studentId —— 获取兑换记录（本人或管理员）
 */
import { HttpError, jsonResponse } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createUserClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env, 'studentId'> = async ({ params, request, env }) => {
  const ctx = await requireAuth(env, request);
  const studentId = String(params.studentId);

  if (!ctx.isAdmin && ctx.userId !== studentId) {
    throw new HttpError(403, '只能查看自己的兑换记录');
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
