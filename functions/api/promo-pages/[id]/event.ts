/**
 * POST /api/promo-pages/:id/event —— 启幕宣传页埋点
 *   body: { type: 'view' | 'click' }
 * 只做计数，失败不抛错（埋点不应影响展示）
 */
import { jsonResponse, readJson } from '../../../lib/http';
import { requireAuth } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  await requireAuth(env, request);
  const id = String(params.id);

  let type = '';
  try {
    const body = await readJson<{ type?: string }>(request);
    type = body.type === 'click' ? 'click' : body.type === 'view' ? 'view' : '';
  } catch {
    return jsonResponse({ ok: false });
  }
  if (!type) return jsonResponse({ ok: false });

  const admin = createAdminClient(env);
  const column = type === 'click' ? 'click_count' : 'view_count';

  const { data } = await admin.from('promo_pages').select(column).eq('id', id).maybeSingle();
  const current = Number((data as Record<string, number> | null)?.[column] ?? 0);
  await admin.from('promo_pages').update({ [column]: current + 1 }).eq('id', id);

  return jsonResponse({ ok: true });
};
