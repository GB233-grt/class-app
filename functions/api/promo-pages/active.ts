/**
 * GET /api/promo-pages/active —— 当前应展示的启幕宣传内容
 *
 * 返回 { item: PromoPublicItem | null }
 *   · 只返回 status=published 且在生效时间窗内的内容
 *   · 按 sort_order → created_at 取第一条，天然避免多条冲突
 *   · 受众与区域不匹配时返回 null
 */
import { HttpError, jsonResponse, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { isWithinWindow, matchesAudience } from '../../lib/promoRules';
import { createAdminClient } from '../../lib/supabase';
import type { Env, PromoPage, PromoPublicItem } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  const admin = createAdminClient(env);

  const { data, error } = await admin
    .from('promo_pages')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new HttpError(500, translateDbError(error.message));

  const now = new Date();
  const studentRegion = ctx.profile.region_id;

  const visible = ((data ?? []) as PromoPage[]).filter((page) => {
    if (!isWithinWindow(page.start_at, page.end_at, now)) return false;
    if (!matchesAudience(page.audience, ctx.profile.role)) return false;
    if (!page.region_id) return true; // 全校内容
    if (ctx.isSuperAdmin) return true;
    if (ctx.isStaff) return ctx.regionScope.regionSet?.has(page.region_id) ?? false;
    return page.region_id === studentRegion;
  });

  const picked = visible[0];
  if (!picked) return jsonResponse({ item: null });

  // 曝光计数：失败不影响展示
  void admin
    .from('promo_pages')
    .update({ view_count: (picked.view_count ?? 0) + 1 })
    .eq('id', picked.id)
    .then(() => undefined);

  const item: PromoPublicItem = {
    id: picked.id,
    title: picked.title,
    body: picked.body,
    image_url: picked.image_url,
    link_url: picked.link_url,
    link_label: picked.link_label,
    frequency: picked.frequency,
  };
  return jsonResponse({ item });
};
