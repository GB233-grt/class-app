/**
 * POST /api/students/award —— 积分增减（教师/管理员）
 * 调用数据库函数 adjust_student_points 原子完成：权限校验 → 校验余额 → 更新 → 写积分明细
 */
import { HttpError, jsonResponse, readJson, requireInt, requireString, translateDbError } from '../../lib/http';
import { requireStaff } from '../../lib/auth';
import { assertStudentAllowed } from '../../lib/rbac';
import { createUserClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

interface AwardBody {
  student_id?: string;
  delta?: number;
  reason?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);

  const body = await readJson<AwardBody>(request);
  const studentId = requireString(body.student_id, '学生 ID');
  const delta = requireInt(body.delta, '积分变动值', { min: -1000000, max: 1000000 });
  if (delta === 0) {
    throw new HttpError(400, '积分变动值不能为 0');
  }
  const reason = requireString(body.reason, '变动原因', { max: 50 });

  // 区域隔离：只能给授权区域（含子孙）内的学生加减分
  await assertStudentAllowed(env, ctx.regionScope, studentId);

  const { data, error } = await createUserClient(env, ctx.token).rpc('adjust_student_points', {
    p_student_id: studentId,
    p_delta: delta,
    p_reason: reason,
    p_actor_id: ctx.userId,
  });

  if (error) {
    throw new HttpError(400, translateDbError(error.message));
  }

  return jsonResponse({
    student_id: studentId,
    delta,
    reason,
    balance_after: data,
  });
};
