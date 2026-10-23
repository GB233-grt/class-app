/**
 * POST /api/redemptions —— 兑换商品（登录用户为自己兑换）
 * 调用数据库函数 redeem_item 原子完成：
 * 锁定商品 → 校验上架/库存/积分 → 扣积分扣库存 → 写兑换记录（快照）→ 写积分明细
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createUserClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

interface RedeemBody {
  item_id?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);

  const body = await readJson<RedeemBody>(request);
  const itemId = requireString(body.item_id, '商品 ID');

  const { data, error } = await createUserClient(env, ctx.token).rpc('redeem_item', {
    p_student_id: ctx.userId,
    p_item_id: itemId,
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
