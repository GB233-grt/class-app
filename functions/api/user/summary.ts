/**
 * GET /api/user/summary —— 当前学生的兑换汇总（件数 / 消耗积分）
 *
 * 为什么单独做接口：兑换记录是分页返回的，前端累加只能算到已加载的那几页。
 * 这里交给数据库一次性聚合，保证数字始终准确。
 */
import { HttpError, jsonResponse } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createUserClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);

  const { data, error } = await createUserClient(env, ctx.token).rpc(
    'student_redemption_summary',
    { p_student_id: ctx.userId },
  );

  if (error) {
    throw new HttpError(500, '获取兑换汇总失败，请确认已执行 16_student_summary.sql');
  }

  // 返回表类型时 PostgREST 给的是数组
  const row = (Array.isArray(data) ? data[0] : data) as
    | { total_items?: number | string; total_spent?: number | string }
    | undefined;

  return jsonResponse({
    total_items: Number(row?.total_items ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
  });
};
