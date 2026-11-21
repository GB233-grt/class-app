/**
 * 启幕宣传页 —— 启动时展示的正能量宣传层
 *
 * 本文件只做「接线」：从 useSplashPromo 拿数据与频次控制，
 * 把字段透传给纯展示组件 PromoDialog；
 * 接口调用、频次判定、埋点语义均保持不变。
 */
import { useCallback } from 'react';
import { useSplashPromo } from '../../../hooks/useSplashPromo';
import { PromoDialog } from './PromoDialog';

/** 自动关闭倒计时（秒） */
const COUNTDOWN_SECONDS = 5;

export function SplashPromo() {
  const { item, visible, close, trackClick } = useSplashPromo();

  /** 点击主按钮：先埋点，再跳转，最后关闭（顺序与改造前一致） */
  const handleActivate = useCallback(() => {
    if (!item) return;
    trackClick();
    if (item.link_url) {
      if (item.link_url.startsWith('/')) {
        window.location.href = item.link_url;
      } else {
        window.open(item.link_url, '_blank', 'noopener,noreferrer');
      }
    }
    close();
  }, [close, item, trackClick]);

  return (
    <PromoDialog
      open={visible}
      title={item?.title ?? ''}
      body={item?.body ?? ''}
      imageUrl={item?.image_url}
      linkUrl={item?.link_url}
      linkLabel={item?.link_label}
      countdownSeconds={COUNTDOWN_SECONDS}
      onActivate={handleActivate}
      onClose={close}
    />
  );
}
