/**
 * 积分排行榜面板：按当前积分排名，高亮当前登录学生
 */
import { Crown, Medal, Trophy, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useLeaderboard } from '../../../hooks/useLeaderboard';
import { Card } from '../../common/Card';
import { EmptyState, ErrorNotice } from '../../common/States';
import { Spinner } from '../../common/Spinner';
import { cn, formatPoints } from '../../../lib/utils';

/** 前三名样式：图标 + 文字色 */
const TOP_THREE: { icon: LucideIcon; className: string }[] = [
  { icon: Crown, className: 'text-amber-500' }, // 金
  { icon: Medal, className: 'text-slate-400' }, // 银
  { icon: Medal, className: 'text-amber-700' }, // 铜
];

export function LeaderboardPanel() {
  const { profile } = useAuth();
  const { entries, loading, error, refresh } = useLeaderboard();

  return (
    <Card className="animate-fade-up mx-auto max-w-2xl p-5 sm:p-6">
      {/* 标题 */}
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="font-display text-lg font-bold text-ink-900">积分排行榜</h2>
        <span className="text-xs text-ink-400">按当前积分排名 · 前 {entries.length || 50} 名</span>
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => void refresh()} />
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="暂无排行数据" description="等老师给学生加分后就有了" />
      ) : (
        <ol className="space-y-1.5">
          {entries.map((entry, index) => {
            const isMe = entry.id === profile?.id;
            const rank = index + 1;
            const top = TOP_THREE[index];
            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                  isMe ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-ink-50',
                )}
              >
                {/* 名次 */}
                <span className="flex w-8 flex-shrink-0 items-center justify-center">
                  {top ? (
                    <top.icon className={cn('h-5 w-5', top.className)} />
                  ) : (
                    <span className="text-sm font-semibold text-ink-400">{rank}</span>
                  )}
                </span>
                {/* 姓名 */}
                <span className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="truncate font-medium text-ink-900">{entry.name}</span>
                  {isMe && (
                    <span className="flex-shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      我
                    </span>
                  )}
                </span>
                {/* 积分 */}
                <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-ink-900">
                  {formatPoints(entry.points)}
                  <span className="text-xs font-normal text-ink-400">积分</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
