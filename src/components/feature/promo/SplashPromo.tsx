/**
 * 启幕宣传页 —— 启动时展示的正能量宣传层
 *
 * 交互：
 *   · 倒计时自动关闭（默认 5 秒）
 *   · 「跳过」立即关闭
 *   · 点击卡片/按钮 → 跳转目标页并关闭
 *
 * 兜底：
 *   · 图片加载失败 → 渐变底 + 图标，标题正文照常显示
 *   · 无内容 → 整个组件不渲染
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Megaphone, X } from 'lucide-react';
import { useSplashPromo } from '../../../hooks/useSplashPromo';
import { cn } from '../../../lib/utils';

/** 自动关闭倒计时（秒） */
const COUNTDOWN_SECONDS = 5;

export function SplashPromo() {
  const { item, visible, close, trackClick } = useSplashPromo();
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [imageFailed, setImageFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 每次出现都重置状态
  useEffect(() => {
    if (!visible) return;
    setRemaining(COUNTDOWN_SECONDS);
    setImageFailed(false);

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [visible, item?.id]);

  // 倒计时归零自动关闭
  useEffect(() => {
    if (visible && remaining === 0) close();
  }, [remaining, visible, close]);

  // Esc 关闭
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, close]);

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

  if (!visible || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="启幕宣传"
    >
      <div className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 跳过 / 倒计时 */}
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          {remaining > 0 ? `${remaining} 秒后关闭` : '关闭'}
          <X className="h-3.5 w-3.5" />
        </button>

        {/* 配图 */}
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-500">
          {item.image_url && !imageFailed ? (
            <img
              src={item.image_url}
              alt={item.title}
              loading="eager"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Megaphone className="h-12 w-12 text-white/70" />
            </div>
          )}
        </div>

        {/* 正文 */}
        <div className="space-y-3 p-6">
          <h2 className="font-display text-xl font-bold leading-snug text-ink-900">{item.title}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.body}</p>

          {item.link_url && (
            <button
              type="button"
              onClick={handleActivate}
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5',
                'text-sm font-medium text-white transition-colors hover:bg-brand-700',
              )}
            >
              {item.link_label || '了解更多'}
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
