/**
 * GET /api/leaderboard —— 学生积分排行榜（所有登录用户可见）
 * 按当前积分倒序返回前 50 名学生，仅释放公开字段（id、姓名、积分）：
 *   - id 供前端高亮"我自己"那一行
 *   - 不包含邮箱、学号等隐私字段
 *
 * 说明：students 表的 RLS 只允许读取自己的行，排行榜需跨用户读取，
 * 因此使用管理员客户端（由本接口严格控制返回字段）。
 */
import { HttpError, jsonResponse } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { createAdminClient } from '../lib/supabase';
import type { Env } from '../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireAuth(env, request);

  // 积分倒序；同分按姓名字典序，保证排名稳定
  const { data, error } = await createAdminClient(env)
    .from('students')
    .select('id, name, points')
    .eq('role', 'student')
    .order('points', { ascending: false })
    .order('name', { ascending: true })
    .limit(50);

  if (error) {
    throw new HttpError(500, '获取排行榜失败');
  }
  return jsonResponse(data ?? []);
};
