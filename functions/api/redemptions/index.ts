/**
 * /api/redemptions
 *   GET  —— 教职工查看全部兑换记录（教师工作台发放队列，支持 ?status 筛选）
 *   POST —— 学生兑换商品（支持选择数量）
 *
 * POST 调用数据库函数 redeem_item 原子完成：
 * 锁定商品 → 校验上架/库存/积分 → 扣积分扣库存 → 写兑换记录（快照）→ 写积分明细
 */
import { HttpError, jsonResponse, readJson, requireInt, requireString, translateDbError } from '../../lib/http';
import { requireAuth, requireStaff } from '../../lib/auth';
import { createUserClient } from '../../lib/supabase';
import type { Env, StaffRedemption } from '../../lib/types';

interface RedeemBody {
  item_id?: string;
  quantity?: number;
}

// 教职工：兑换发放记录（默认按时间倒序，可按发放状态筛选）
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);

  const status = new URL(request.url).searchParams.get('status');
  let query = createUserClient(env, ctx.token)
    .from('redemptions')
    .select(
      // redemptions 有两条指向 students 的外键（student_id / fulfilled_by），
      // 必须用 !student_id 显式消歧，否则 PostgREST 报"关系不明确"
      'id, student_id, item_id, item_name, cost, quantity, status, fulfilled_at, fulfilled_by, download_url, created_at, students!student_id(name, student_no)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status === 'pending' || status === 'fulfilled') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    // 附带底层原因，便于诊断 RLS / 字段问题（本接口仅教师/管理员可达）
    throw new HttpError(500, `获取兑换记录失败：${error.message}`);
  }
  // supabase-js 将内嵌关联推断为数组，运行时 PostgREST 对多对一关联返回对象
  return jsonResponse((data ?? []) as unknown as StaffRedemption[]);
};

// 学生：兑换商品（数量由前端选择，后端二次校验）
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);

  const body = await readJson<RedeemBody>(request);
  const itemId = requireString(body.item_id, '商品 ID');
  const quantity = requireInt(body.quantity ?? 1, '兑换数量', { min: 1, max: 99 });

  const { data, error } = await createUserClient(env, ctx.token).rpc('redeem_item', {
    p_student_id: ctx.userId,
    p_item_id: itemId,
    p_quantity: quantity,
  });

  if (error) {
    throw new HttpError(400, translateDbError(error.message));
  }

  // 数据库函数返回表类型，PostgREST 以数组返回
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    throw new HttpError(500, '兑换失败，请稍后重试');
  }

  return jsonResponse(
    {
      message: '兑换成功',
      redemption_id: result.redemption_id,
      balance_after: result.balance_after,
    },
    201,
  );
};
