/**
 * 启幕宣传页的纯规则函数（便于单测，不碰 IO）
 *
 * 三条规则：
 *   1. 时间窗：start_at/end_at 之内才可见
 *   2. 受众：all / student / staff
 *   3. 链接：必须 https，且域名命中白名单（校园宣传不允许未审核的外部链接）
 */
import type { UserRole } from './types';

export type PromoAudience = 'all' | 'student' | 'staff';

/** 时间窗判定：空值表示不限 */
export function isWithinWindow(
  startAt: string | null,
  endAt: string | null,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  if (startAt) {
    const start = new Date(startAt).getTime();
    if (Number.isNaN(start) || t < start) return false;
  }
  if (endAt) {
    const end = new Date(endAt).getTime();
    if (Number.isNaN(end) || t >= end) return false;
  }
  return true;
}

/** 受众匹配：教职工（教师/管理员/超管）视为 staff */
export function matchesAudience(audience: PromoAudience, role: UserRole): boolean {
  if (audience === 'all') return true;
  if (audience === 'student') return role === 'student';
  return role === 'teacher' || role === 'admin' || role === 'super_admin';
}

/** 站内相对路径（/xxx）永远放行 */
function isRelativePath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * 校验跳转链接。
 *
 * 规则刻意保持宽松：只要是一个能正常跳转的地址即可（http / https / 站内路径）。
 * 内容合规由「审核」环节把关，不再限制域名——
 * 但协议非法（javascript:、data: 等）与协议相对路径（//host）一律拒绝。
 *
 * @returns null 表示通过，否则返回中文错误提示
 */
export function validatePromoLink(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null; // 允许不填链接（纯展示）
  if (isRelativePath(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '跳转地址格式不正确，请填写完整链接（如 https://example.com/page）或站内路径（如 /store）';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '跳转地址只支持 http / https 链接';
  }
  return null;
}

/** 校验图片地址：允许 https 或站内路径，不允许 data: 等 */
export function validatePromoImage(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (isRelativePath(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '图片地址格式不正确';
  }
  if (parsed.protocol !== 'https:') {
    return '图片地址必须是 https 开头';
  }
  return null;
}
