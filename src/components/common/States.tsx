/**
 * 空状态与错误提示
 */
import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

/** 空状态占位 */
export function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white/60 py-12 text-center">
      <Icon className="h-8 w-8 text-ink-300" />
      <p className="text-sm font-medium text-ink-600">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-400">{description}</p>}
    </div>
  );
}

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

/** 加载失败提示（可重试） */
export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="px-4 text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          重新加载
        </Button>
      )}
    </div>
  );
}
