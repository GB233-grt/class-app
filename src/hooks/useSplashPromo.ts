/**
 * 启幕宣传页数据 Hook
 * 拉取当前应展示的内容列表 → 按频次过滤 → 逐条展示（关闭一条后接着展示下一条）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { promoApi } from '../api';
import { useAuth } from './useAuth';
import { markPromoShown, shouldShowPromo } from '../lib/promoFrequency';
import type { PromoPublicItem } from '../types';

export function useSplashPromo() {
  const { profile } = useAuth();
  /** 待展示队列（已按频次过滤） */
  const [queue, setQueue] = useState<PromoPublicItem[]>([]);
  /** 当前展示到第几条 */
  const [index, setIndex] = useState(0);
  /** 防止 StrictMode 下重复拉取 */
  const loadedRef = useRef(false);

  const item = queue[index] ?? null;
  const visible = Boolean(item);

  useEffect(() => {
    if (!profile || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const result = await promoApi.active();
        if (cancelled) return;
        const pending = (result.items ?? []).filter((entry) =>
          shouldShowPromo(entry, profile.id),
        );
        if (pending.length === 0) return;
        setQueue(pending);
        setIndex(0);
      } catch {
        // 宣传页失败一律静默，不能影响主流程
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  // 每展示一条，上报一次曝光（失败静默）
  useEffect(() => {
    if (!item) return;
    void promoApi.event(item.id, 'view');
  }, [item]);

  /** 关闭当前这条：写入频次记录，并切到下一条 */
  const close = useCallback(() => {
    if (item && profile) markPromoShown(item, profile.id);
    setIndex((prev) => prev + 1);
  }, [item, profile]);

  /** 点击主按钮时上报点击 */
  const trackClick = useCallback(() => {
    if (item) void promoApi.event(item.id, 'click');
  }, [item]);

  return { item, visible, close, trackClick };
}
