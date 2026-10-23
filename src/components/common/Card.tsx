/**
 * 通用卡片容器
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Card({ className, style, children }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-ink-100 bg-white shadow-soft', className)} style={style}>
      {children}
    </div>
  );
}
