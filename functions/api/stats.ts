/**
 * GET /api/stats —— 管理员统计概览
 * 返回：商品目录数量、总库存单位数、发放给学生总积分、学生人数
 */
import { HttpError, jsonResponse } from '../lib/http';
import { requireAdmin } from '../lib/auth';
import { createUserClient } from '../lib/supabase';
import type { Env } from '../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAdmin(env, request);
  const client = createUserClient(env, ctx.token);

  const [itemsResult, ledgerResult, studentsResult] = await Promise.all([
    // 上架商品及其库存
    client.from('items').select('stock').eq('is_active', true),
    // 累计发放积分：所有正向积分明细之和
    client.from('points_ledger').select('delta').gt('delta', 0),
    // 学生人数（不含管理员）
    client.from('students').select('id').eq('role', 'student'),
  ]);

  if (itemsResult.error) throw new HttpError(500, '统计商品数据失败');
  if (ledgerResult.error) throw new HttpError(500, '统计积分数据失败');
  if (studentsResult.error) throw new HttpError(500, '统计学生数据失败');

  const itemCount = itemsResult.data.length;
  const totalStock = itemsResult.data.reduce(
    (sum: number, row: { stock?: number }) => sum + (row.stock ?? 0),
    0,
  );
  const totalAwarded = ledgerResult.data.reduce(
    (sum: number, row: { delta?: number }) => sum + (row.delta ?? 0),
    0,
  );
  const studentCount = studentsResult.data.length;

  return jsonResponse({
    item_count: itemCount,
    total_stock: totalStock,
    total_awarded: totalAwarded,
    student_count: studentCount,
  });
};
