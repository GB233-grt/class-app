/**
 * 启幕宣传页数据 Hook
 * 拉取当前应展示的内容 → 检查本地频次 → 控制覆盖层显隐
 */
import { useCallback, useEffect, useState } from 'react';
import { promoApi } from '../api';
import { useAuth } from './useAuth';
import { markPromoShown, shouldShowPromo } from '../lib/promoFrequency';
import type { PromoPublicItem } from '../types';

export function useSplashPromo() {
  const { profile } = useAuth();
  const [item, setItem] = useState<PromoPublicItem | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await promoApi.active();
        if (cancelled || !result.item) return;
        if (!shouldShowPromo(result.item, profile.id)) return;
        setItem(result.item);
        setVisible(true);
        // 曝光埋点失败不影响展示
        void promoApi.event(result.item.id, 'view');
      } catch {
        // 宣传页失败一律静默，不能影响主流程
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  /** 关闭（跳过 / 倒计时结束 / 点击后）——立即写频次，避免刷新重复弹出 */
  const close = useCallback(() => {
    if (item && profile) markPromoShown(item, profile.id);
    setVisible(false);
  }, [item, profile]);

  /** 点击卡片或按钮时上报点击 */
  const trackClick = useCallback(() => {
    if (item) void promoApi.event(item.id, 'click');
  }, [item]);

  return { item, visible, close, trackClick };
}
