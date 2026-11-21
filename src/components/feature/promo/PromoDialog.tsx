/**
 * 启幕宣传页弹窗（纯展示组件）
 *
 * 只负责 UI 与交互，不做任何接口调用、不感知频次策略：
 *   标题 / 正文 / 配图 / 跳转链接 / 按钮文案 / 倒计时秒数 全部由 props 传入。
 *
 * 视觉基调参考 Linear / GitHub 的通知弹窗：白底、克制留白、无大面积色块。
 * 交互：ESC 关闭、点击遮罩关闭、倒计时结束自动关闭、打开时锁定 body 滚动并把焦点移入弹窗。
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface PromoDialogProps {
  /** 是否展示 */
  open: boolean;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** 自动关闭倒计时（秒） */
  countdownSeconds?: number;
  /** 点击主按钮（跳转）时触发；由外层负责埋点与跳转 */
  onActivate?: () => void;
  /** 关闭（跳过 / 倒计时归零 / 点遮罩 / ESC） */
  onClose: () => void;
}

/** 正文支持 **关键句** 加粗；其余按纯文本渲染并保留换行 */
function renderBody(text: string) {
  return text.split('**').map((segment, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-[#0F172A]">
        {segment}
      </strong>
    ) : (
      <span key={index}>{segment}</span>
    ),
  );
}

export function PromoDialog({
  open,
  title,
  body,
  imageUrl,
  linkUrl,
  linkLabel,
  countdownSeconds = 5,
  onActivate,
  onClose,
}: PromoDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [imageFailed, setImageFailed] = useState(false);

  // 打开时：重置状态 + 锁定滚动 + 聚焦弹窗
  useEffect(() => {
    if (!open) return;

    setRemaining(countdownSeconds);
    setImageFailed(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, countdownSeconds]);

  // 倒计时
  useEffect(() => {
    if (!open) return;
    if (remaining <= 0) return;

    const timer = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, remaining]);

  // 归零自动关闭
  useEffect(() => {
    if (open && remaining === 0) onClose();
  }, [open, remaining, onClose]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  /** 点遮罩关闭；点内容区不触发 */
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  const showImage = Boolean(imageUrl) && !imageFailed;
  const hasLink = Boolean(linkUrl);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[4px]"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-promo-in w-[90vw] max-w-[480px] rounded-2xl bg-white outline-none',
          'shadow-[0_20px_50px_rgba(0,0,0,0.15)]',
          'p-5 sm:p-6',
        )}
      >
        {/* 顶部：标签 + 关闭 */}
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-[6px] bg-brand-50 px-2 py-1 text-[12px] font-medium leading-none text-brand-700">
            启幕宣传
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 配图：有图才渲染，加载失败直接移除 */}
        {showImage && (
          <img
            src={imageUrl as string}
            alt=""
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="mt-4 h-[180px] w-full rounded-xl object-cover"
          />
        )}

        {/* 标题 */}
        <h2
          id={titleId}
          className="mt-4 text-[20px] font-semibold leading-[1.4] text-[#0F172A]"
        >
          {title}
        </h2>

        {/* 正文：保留换行，支持 **加粗** */}
        <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.75] text-[#475569]">
          {renderBody(body)}
        </p>

        {/* 底部操作 */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {remaining > 0 ? `稍后再说（${remaining}s）` : '稍后再说'}
          </button>
          {hasLink && (
            <button
              type="button"
              onClick={onActivate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {linkLabel || '了解更多'}
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
