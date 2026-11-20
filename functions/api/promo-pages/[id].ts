/**
 * /api/promo-pages/:id
 *   PUT    —— 编辑内容（创建者仅限 draft/rejected；管理员不限）
 *   DELETE —— 删除（管理员；建议仅删除 draft/rejected）
 *   POST   —— 状态流转，body: { action: 'submit'|'approve'|'reject'|'publish'|'offline', reason? }
 *
 * 审核规则：
 *   · submit  由创建者提交，draft/rejected → pending
 *   · approve 由管理员审核，pending → published（发布前再次校验必填项与链接合规）
 *   · reject  由管理员驳回，pending → rejected（必须写理由）
 *   · offline 由管理员下线，published → offline
 *   · publish 由管理员重新上线，offline → published
 */
import {
  HttpError,
  jsonResponse,
  optionalString,
  readJson,
  requireString,
  translateDbError,
} from '../../lib/http';
import { requireStaff } from '../../lib/auth';
import { isRegionAllowed } from '../../lib/rbac';
import { validatePromoLink } from '../../lib/promoRules';
import { createAdminClient } from '../../lib/supabase';
import type { Env, PromoPage } from '../../lib/types';
import { parsePromoBody } from '../../lib/promoBody';

async function loadPage(env: Env, id: string): Promise<PromoPage> {
  const { data, error } = await createAdminClient(env)
    .from('promo_pages')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new HttpError(500, translateDbError(error.message));
  if (!data) throw new HttpError(404, '宣传内容不存在');
  return data as PromoPage;
}

/** 非超管只能操作自己授权区域的内容；全校内容（region_id 为空）仅超管可管 */
function assertCanManage(ctx: Awaited<ReturnType<typeof requireStaff>>, page: PromoPage): void {
  if (ctx.isSuperAdmin) return;
  if (!isRegionAllowed(ctx.regionScope, page.region_id)) {
    throw new HttpError(403, '没有权限管理该区域的内容');
  }
}

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireStaff(env, request);
  const id = String(params.id);
  const page = await loadPage(env, id);
  assertCanManage(ctx, page);

  // 可编辑状态：
  //   · 草稿 / 已驳回 / 已下线 —— 创建者本人或管理员都可改
  //   · 已发布 —— 仅管理员可直接改（改动立即对师生生效）；创建者需先由管理员下线
  //   · 待审核 —— 不能改，避免审核中的内容被掉包
  const ownerEditable = ['draft', 'rejected', 'offline'].includes(page.status);
  const isOwner = page.created_by === ctx.userId;
  if (!ctx.isAdmin) {
    if (!isOwner) throw new HttpError(403, '只能编辑自己创建的内容');
    if (!ownerEditable) {
      throw new HttpError(403, '内容审核中或已发布，不能直接编辑。请等待审核结果，或联系管理员下线后再修改');
    }
  }

  const body = await readJson<Record<string, unknown>>(request);
  const fields = parsePromoBody(body, env, true);
  if (Object.keys(fields).length === 0) throw new HttpError(400, '没有需要更新的内容');

  if (fields.region_id !== undefined && !ctx.isSuperAdmin) {
    if (!isRegionAllowed(ctx.regionScope, fields.region_id)) {
      throw new HttpError(403, '没有权限把内容归属到该区域');
    }
  }

  const { data, error } = await createAdminClient(env)
    .from('promo_pages')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data);
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireStaff(env, request);
  if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以删除宣传内容');

  const id = String(params.id);
  const page = await loadPage(env, id);
  assertCanManage(ctx, page);

  if (page.status === 'published') {
    throw new HttpError(400, '已发布的内容请先下线再删除');
  }

  const { error } = await createAdminClient(env).from('promo_pages').delete().eq('id', id);
  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse({ message: '已删除' });
};

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireStaff(env, request);
  const id = String(params.id);
  const page = await loadPage(env, id);
  assertCanManage(ctx, page);

  const body = await readJson<Record<string, unknown>>(request);
  const action = requireString(body.action, '操作', { max: 20 });
  const admin = createAdminClient(env);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'submit') {
    if (page.created_by !== ctx.userId && !ctx.isAdmin) {
      throw new HttpError(403, '只能提交自己创建的内容');
    }
    if (!['draft', 'rejected', 'offline'].includes(page.status)) {
      throw new HttpError(409, '当前状态不能提交审核');
    }
    update.status = 'pending';
    update.reject_reason = null;
  } else if (action === 'approve') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以审核');
    if (page.status !== 'pending') throw new HttpError(409, '只有待审核内容可以审核');
    // 发布前再校验一次链接合规（防止旧数据绕过）
    const linkError = validatePromoLink(page.link_url ?? '');
    if (linkError) throw new HttpError(400, `链接不合规：${linkError}`);
    if (!page.title || !page.body) throw new HttpError(400, '标题与正文不能为空');
    update.status = 'published';
    update.reviewed_by = ctx.userId;
    update.reviewed_at = new Date().toISOString();
    update.reject_reason = null;
  } else if (action === 'reject') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以审核');
    if (page.status !== 'pending') throw new HttpError(409, '只有待审核内容可以驳回');
    const reason = optionalString(body.reason, 200);
    if (!reason) throw new HttpError(400, '驳回时必须填写理由');
    update.status = 'rejected';
    update.reject_reason = reason;
    update.reviewed_by = ctx.userId;
    update.reviewed_at = new Date().toISOString();
  } else if (action === 'offline') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以下线');
    if (page.status !== 'published') throw new HttpError(409, '只有已发布内容可以下线');
    update.status = 'offline';
  } else if (action === 'publish') {
    if (!ctx.isAdmin) throw new HttpError(403, '只有管理员可以发布');
    if (!['offline', 'draft'].includes(page.status)) {
      throw new HttpError(409, '当前状态不能直接发布');
    }
    const linkError = validatePromoLink(page.link_url ?? '');
    if (linkError) throw new HttpError(400, `链接不合规：${linkError}`);
    update.status = 'published';
    update.reviewed_by = ctx.userId;
    update.reviewed_at = new Date().toISOString();
  } else {
    throw new HttpError(400, '不支持的操作');
  }

  const { data, error } = await admin.from('promo_pages').update(update).eq('id', id).select('*').single();
  if (error) throw new HttpError(500, translateDbError(error.message));
  return jsonResponse(data);
};
