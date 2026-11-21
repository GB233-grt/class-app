/**
 * 启幕宣传页的展示频次控制（纯本地记录，不上传）
 *
 * 三种策略：
 *   once_per_launch   每次启动应用展示一次 —— 用内存标记，
 *                     即「每打开/刷新一次页面算一次启动」，刷新后会再次出现
 *   daily             每天一次（localStorage，按用户本地日期）
 *   once_per_content  同一条内容只展示一次（localStorage，永久）
 *
 * key 里都带 userId，换账号不会互相影响。
 */
import type { PromoFrequency, PromoPublicItem } from '../types';

/** once_per_launch 的内存标记：模块级，页面刷新即清空 */
const launchShown = new Set<string>();

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

function launchKey(userId: string, contentId: string): string {
  return `${userId}:${contentId}`;
}

/** 读取 localStorage 时不抛错（隐私模式下可能不可用） */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // 忽略：存储不可用时退化为“总是展示”
  }
}

/** 判断这条内容现在是否应该展示 */
export function shouldShowPromo(item: PromoPublicItem, userId: string): boolean {
  const frequency: PromoFrequency = item.frequency;
  if (frequency === 'once_per_launch') {
    return !launchShown.has(launchKey(userId, item.id));
  }
  if (frequency === 'daily') {
    return safeGet(dailyKey(userId, item.id)) === null;
  }
  return safeGet(contentKey(userId, item.id)) === null;
}

/** 记录“已展示”，下次按频次策略跳过 */
export function markPromoShown(item: PromoPublicItem, userId: string): void {
  const frequency: PromoFrequency = item.frequency;
  if (frequency === 'once_per_launch') {
    launchShown.add(launchKey(userId, item.id));
    return;
  }
  if (frequency === 'daily') {
    safeSet(dailyKey(userId, item.id));
    return;
  }
  safeSet(contentKey(userId, item.id));
}
