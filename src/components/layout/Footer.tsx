/**
 * 页面页脚：左侧依次展示「系统消息」与「帮助」
 * 「系统消息」弹层展示版本公告；「帮助」弹层展示项目作者与分角色使用方法
 */
import { useEffect, useState } from 'react';
import { MessageSquare, CircleHelp, X } from 'lucide-react';
import { PROJECT_AUTHOR, SYSTEM_MESSAGES, USAGE_GUIDE } from '../../lib/constants';
import { cn } from '../../lib/utils';

type FooterModal = 'system' | 'help' | null;

export function Footer() {
  const [open, setOpen] = useState<FooterModal>(null);

  // 弹层打开时按 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const linkClass =
    'transition-colors hover:text-ink-900 hover:underline underline-offset-4 decoration-ink-300';

  return (
    <footer className="border-t border-ink-100 bg-white/70">
      {/* 内容靠左对齐，依次显示：系统消息、帮助 */}
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 text-sm text-ink-500 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen('system')}
          className={cn('flex items-center gap-1.5', linkClass)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          系统消息
        </button>
        <button
          type="button"
          onClick={() => setOpen('help')}
          className={cn('flex items-center gap-1.5', linkClass)}
        >
          <CircleHelp className="h-3.5 w-3.5" />
          帮助
        </button>
      </div>

      {/* 弹层 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={open === 'system' ? '系统消息' : '帮助'}
        >
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setOpen(null)}
          />
          <div className="animate-fade-up relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink-900">
                {open === 'system' ? '系统消息' : '帮助'}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="关闭"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {open === 'system' ? (
              <ul className="space-y-3">
                {SYSTEM_MESSAGES.map((message) => (
                  <li key={message.title} className="rounded-lg bg-ink-50 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      {message.title}
                    </p>
                    <p className="mt-1 pl-3.5 text-sm leading-relaxed text-ink-500">
                      {message.detail}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-brand-50 px-4 py-3">
                  <p className="text-sm font-medium text-ink-900">项目作者</p>
                  <p className="mt-1 text-sm text-ink-600">{PROJECT_AUTHOR}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-ink-900">使用方法</p>
                  <div className="space-y-3">
                    {USAGE_GUIDE.map((section) => (
                      <div key={section.role} className="rounded-lg bg-ink-50 px-4 py-3">
                        <p className="text-sm font-medium text-ink-900">{section.role}</p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-600">
                          {section.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
