/**
 * 统计卡片：左侧图标 + 右侧数字 + 下方标签
 */
import type { LucideIcon } from 'lucide-react';
import { Card } from '../common/Card';
import { cn } from '../../lib/utils';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  accent: 'bg-orange-50 text-accent-500',
  ink: 'bg-ink-100 text-ink-700',
} as const;

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: keyof typeof TONES;
  /** 渐入动画延迟（毫秒） */
  delay?: number;
}

export function StatCard({ icon: Icon, value, label, tone = 'brand', delay = 0 }: StatCardProps) {
  return (
    <Card className="animate-fade-up p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-2xl font-bold leading-tight text-ink-900">{value}</div>
          <div className="truncate text-sm text-ink-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}
