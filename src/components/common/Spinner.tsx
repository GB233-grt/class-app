/**
 * 加载指示器与整页加载
 */
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/** 行内旋转图标 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-500', className)} />;
}

/** 整页加载（启动/鉴权探测时使用） */
export function PageLoader({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 text-ink-500">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
