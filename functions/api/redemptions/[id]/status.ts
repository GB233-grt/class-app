/**
 * POST /api/redemptions/:id/status —— 更新发放状态（教师/管理员）
 * 调用数据库函数 update_redemption_status 原子完成：
 * 权限校验 → 记录存在性 → 状态流转合法性 → 更新状态并留痕（时间 + 操作人）
 * 待发放 → 已发放：记录发放时间与操作人
 * 已发放 → 待发放：撤回（清空留痕，不退积分——积分在兑换时已扣除）
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireStaff } from '../../../lib/auth';
import { createUserClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

interface StatusBody {
  status?: string;
}

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireStaff(env, request);
  const redemptionId = String(params.id);

  const body = await readJson<StatusBody>(request);
  const raw = requireString(body.status, '发放状态');
  const status = raw === 'fulfilled' ? 'fulfilled' : raw === 'pending' ? 'pending' : null;
  if (status === null) {
    throw new HttpError(400, '非法的发放状态');
  }

  const { error } = await createUserClient(env, ctx.token).rpc('update_redemption_status', {
    p_redemption_id: redemptionId,
    p_new_status: status,
  });

  if (error) {
    throw new HttpError(400, translateDbError(error.message));
  }

  return jsonResponse({ id: redemptionId, status });
};
