/**
 * POST /api/admin/easter-egg-videos/:id/action —— 审核与上下线
 * body: { action: 'approve'|'reject'|'disable'|'enable', reason? }
 *
 * 审核员不得审核自己提交的视频；区域管理员只能操作自己授权区域；
 * 超级管理员可以操作全部区域。
 */
import { HttpError, jsonResponse, optionalString, readJson, requireString, translateDbError } from '../../../../lib/http';
import { requireStaff } from '../../../../lib/auth';
import { assertRegionAllowed } from '../../../../lib/rbac';
import { createAdminClient } from '../../../../lib/supabase';
import type { Env } from '../../../../lib/types';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireStaff(env, request);
  const id = String(params.id);
  const body = await readJson<Record<string, unknown>>(request);
  const action = requireString(body.action, '操作', { max: 20 });

  const admin = createAdminClient(env);
  const { data: video, error: readError } = await admin
    .from('easter_egg_videos')
    .select('id, title, bvid, status, is_active, created_by, region_id')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw new HttpError(500, translateDbError(readError.message));
  if (!video) throw new HttpError(404, '视频不存在');
  if (!ctx.regionScope.isSuperAdmin) assertRegionAllowed(ctx.regionScope, video.region_id);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'approve' || action === 'reject') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以审核视频');
    if (video.status !== 'pending') throw new HttpError(409, '只有待审核视频可以审核');
    if (video.created_by === ctx.userId && !ctx.isSuperAdmin) {
      throw new HttpError(403, '不能审核自己提交的视频');
    }
    update.status = action === 'approve' ? 'approved' : 'rejected';
    update.reviewed_by = ctx.userId;
    update.reviewed_at = new Date().toISOString();
    if (action === 'reject') {
      const reason = optionalString(body.reason, 300);
      if (!reason) throw new HttpError(400, '驳回时必须填写理由');
      update.reject_reason = reason;
    } else {
      update.reject_reason = null;
    }
  } else if (action === 'disable' || action === 'enable') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以调整视频上下线');
    if (video.status !== 'approved') throw new HttpError(409, '只有审核通过的视频可以上下线');
    update.is_active = action === 'enable';
  } else {
    throw new HttpError(400, '不支持的操作');
  }

  const { data, error } = await admin
    .from('easter_egg_videos')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data);
};
