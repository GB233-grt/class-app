/**
 * 启幕宣传页的展示频次控制（纯本地记录，不上传）
 *
 * 三种策略：
 *   once_per_launch   每次启动应用展示一次（用 sessionStorage，关掉标签页即重置）
 *   daily             每天一次（localStorage，按用户本地日期）
 *   once_per_content  同一条内容只展示一次（localStorage）
 *
 * key 里都带 userId，换账号不会互相影响。
 */
import type { PromoFrequency, PromoPublicItem } from '../types';

function dailyKey(userId: string, contentId: string): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `promo_daily:${userId}:${contentId}:${ymd}`;
}

function contentKey(userId: string, contentId: string): string {
  return `promo_seen:${userId}:${contentId}`;
}

function sessionKey(userId: string, contentId: string): string {
  return `promo_launch:${userId}:${contentId}`;
}

/** 读取 storage 时不抛错（隐私模式下可能不可用） */
function safeGet(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: 'local' | 'session', key: string, value: string): void {
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // 忽略：存储不可用时退化为“总是展示”
  }
}

/** 判断这条内容现在是否应该展示 */
export function shouldShowPromo(item: PromoPublicItem, userId: string): boolean {
  const frequency: PromoFrequency = item.frequency;
  if (frequency === 'once_per_launch') {
    return safeGet('session', sessionKey(userId, item.id)) === null;
  }
  if (frequency === 'daily') {
    return safeGet('local', dailyKey(userId, item.id)) === null;
  }
  return safeGet('local', contentKey(userId, item.id)) === null;
}

/** 记录“已展示”，下次按频次策略跳过 */
export function markPromoShown(item: PromoPublicItem, userId: string): void {
  const frequency: PromoFrequency = item.frequency;
  if (frequency === 'once_per_launch') {
    safeSet('session', sessionKey(userId, item.id), '1');
    return;
  }
  if (frequency === 'daily') {
    safeSet('local', dailyKey(userId, item.id), '1');
    return;
  }
  safeSet('local', contentKey(userId, item.id), '1');
}
