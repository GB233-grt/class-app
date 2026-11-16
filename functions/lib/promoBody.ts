/**
 * 启幕宣传页请求体解析与校验（供创建/编辑复用）
 */
import { HttpError, optionalString, requireString } from './http';
import { validatePromoImage, validatePromoLink } from './promoRules';
import type { Env, PromoPage } from './types';

const FREQUENCIES = ['once_per_launch', 'daily', 'once_per_content'] as const;
const AUDIENCES = ['all', 'student', 'staff'] as const;

/** partial=true 时用于编辑：只校验请求里出现的字段 */
export function parsePromoBody(
  body: Record<string, unknown>,
  _env: Env,
  partial = false,
): Partial<PromoPage> {
  const result: Partial<PromoPage> = {};

  if (!partial || body.title !== undefined) {
    result.title = requireString(body.title, '标题', { max: 40 });
  }
  if (!partial || body.body !== undefined) {
    result.body = requireString(body.body, '正文', { max: 300 });
  }
  if (body.image_url !== undefined) {
    const imageUrl = optionalString(body.image_url, 500);
    const error = validatePromoImage(imageUrl ?? '');
    if (error) throw new HttpError(400, error);
    result.image_url = imageUrl;
  }
  if (body.link_url !== undefined) {
    const linkUrl = optionalString(body.link_url, 500);
    const error = validatePromoLink(linkUrl ?? '');
    if (error) throw new HttpError(400, error);
    result.link_url = linkUrl;
  }
  if (body.link_label !== undefined) {
    result.link_label = optionalString(body.link_label, 12);
  }
  if (body.frequency !== undefined) {
    const frequency = requireString(body.frequency, '展示频次', { max: 30 });
    if (!FREQUENCIES.includes(frequency as (typeof FREQUENCIES)[number])) {
      throw new HttpError(400, '展示频次取值不合法');
    }
    result.frequency = frequency as PromoPage['frequency'];
  }
  if (body.audience !== undefined) {
    const audience = requireString(body.audience, '受众', { max: 20 });
    if (!AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) {
      throw new HttpError(400, '受众取值不合法');
    }
    result.audience = audience as PromoPage['audience'];
  }
  if (body.region_id !== undefined) {
    result.region_id = optionalString(body.region_id, 40);
  }
  if (body.start_at !== undefined) {
    result.start_at = optionalString(body.start_at, 40);
  }
  if (body.end_at !== undefined) {
    result.end_at = optionalString(body.end_at, 40);
  }
  if (
    result.start_at &&
    result.end_at &&
    new Date(result.end_at).getTime() <= new Date(result.start_at).getTime()
  ) {
    throw new HttpError(400, '结束时间必须晚于开始时间');
  }
  if (body.sort_order !== undefined) {
    const sort = Number(body.sort_order);
    if (!Number.isInteger(sort)) throw new HttpError(400, '排序必须是整数');
    result.sort_order = sort;
  }

  return result;
}
