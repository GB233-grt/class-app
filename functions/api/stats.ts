/**
 * GET /api/stats —— 统计概览
 * 返回：商品目录数量、总库存单位数、发放给学生总积分、学生人数
 *
 * 区域隔离：商品是全库共享的（同一批库存），因此商品维度不做区域过滤；
 *          学生人数与发放积分只统计当前用户授权区域（含子孙）内的学生。
 */
import { HttpError, jsonResponse } from '../lib/http';
import { requireAdmin } from '../lib/auth';
import { createUserClient } from '../lib/supabase';
import type { Env } from '../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAdmin(env, request);
  const client = createUserClient(env, ctx.token);

  const allowedRegions = ctx.regionScope.isSuperAdmin ? null : ctx.regionScope.regionIds ?? [];

  let studentsQuery = client.from('students').select('id, role, region_id');
  if (allowedRegions) {
    studentsQuery = studentsQuery.in('region_id', allowedRegions);
  }

  const itemsResult = await client.from('items').select('stock').eq('is_active', true);
  if (itemsResult.error) throw new HttpError(500, '统计商品数据失败');

  // 没有任何授权区域：学生维度的统计一律为 0
  if (allowedRegions && allowedRegions.length === 0) {
    return jsonResponse({
      item_count: itemsResult.data.length,
      total_stock: itemsResult.data.reduce((sum: number, row: { stock?: number }) => sum + (row.stock ?? 0), 0),
      total_awarded: 0,
      student_count: 0,
    });
  }

  const studentsResult = await studentsQuery;
  if (studentsResult.error) throw new HttpError(500, '统计学生数据失败');

  const students = studentsResult.data as { id: string; role: string }[];
  const studentIds = students.filter((s) => s.role === 'student').map((s) => s.id);

  let totalAwarded = 0;
  if (studentIds.length > 0) {
    const ledgerResult = await client
      .from('points_ledger')
      .select('delta')
      .gt('delta', 0)
      .in('student_id', studentIds);
    if (ledgerResult.error) throw new HttpError(500, '统计积分数据失败');
    totalAwarded = ledgerResult.data.reduce(
      (sum: number, row: { delta?: number }) => sum + (row.delta ?? 0),
      0,
    );
  }

  return jsonResponse({
    item_count: itemsResult.data.length,
    total_stock: itemsResult.data.reduce(
      (sum: number, row: { stock?: number }) => sum + (row.stock ?? 0),
      0,
    ),
    total_awarded: totalAwarded,
    student_count: studentIds.length,
  });
};
