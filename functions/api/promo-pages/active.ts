/**
 * GET /api/promo-pages/active —— 当前应展示的启幕宣传内容列表
 *
 * 返回 { items: PromoPublicItem[] }
 *   · 只返回 status=published 且处于生效时间窗内的内容
 *   · 按 sort_order → created_at 排序，前端按顺序依次展示（可能多条）
 *   · 受众与区域不匹配的会被过滤掉
 *   · 曝光计数不在这里做，由前端在真正展示某条时调用 /event 上报
 */
import { HttpError, jsonResponse, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { isWithinWindow, matchesAudience } from '../../lib/promoRules';
import { createAdminClient } from '../../lib/supabase';
import type { Env, PromoPage, PromoPublicItem } from '../../lib/types';

/** 单次最多返回多少条，避免一次弹太多 */
const MAX_ITEMS = 10;

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

  const visible = ((data ?? []) as PromoPage[])
    .filter((page) => {
      if (!isWithinWindow(page.start_at, page.end_at, now)) return false;
      if (!matchesAudience(page.audience, ctx.profile.role)) return false;
      if (!page.region_id) return true; // 全校内容
      if (ctx.isSuperAdmin) return true;
      if (ctx.isStaff) return ctx.regionScope.regionSet?.has(page.region_id) ?? false;
      return page.region_id === studentRegion;
    })
    .slice(0, MAX_ITEMS);

  const items: PromoPublicItem[] = visible.map((page) => ({
    id: page.id,
    title: page.title,
    body: page.body,
    image_url: page.image_url,
    link_url: page.link_url,
    link_label: page.link_label,
    frequency: page.frequency,
  }));

  return jsonResponse({ items });
};
