/**
 * 学生仪表盘：积分卡片 + 统计数据 + 兑换商品/兑换记录/积分明细/排行榜
 */
import { useMemo, useState } from 'react';
import { Coins, Gift, ReceiptText, ScrollText, ShoppingBag, Trophy, type LucideIcon } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { StatCard } from '../components/feature/StatCard';
import { StorePanel } from '../components/feature/student/StorePanel';
import { RedemptionsPanel } from '../components/feature/student/RedemptionsPanel';
import { LedgerPanel } from '../components/feature/student/LedgerPanel';
import { LeaderboardPanel } from '../components/feature/student/LeaderboardPanel';
import { useAuth } from '../hooks/useAuth';
import { useRedemptions } from '../hooks/useRedemptions';
import { cn, formatPoints } from '../lib/utils';

type StudentTabKey = 'store' | 'history' | 'ledger' | 'leaderboard';

const TABS: { key: StudentTabKey; label: string; icon: LucideIcon }[] = [
  { key: 'store', label: '兑换商品', icon: ShoppingBag },
  { key: 'history', label: '兑换记录', icon: ReceiptText },
  { key: 'ledger', label: '积分明细', icon: ScrollText },
  { key: 'leaderboard', label: '排行榜', icon: Trophy },
];

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<StudentTabKey>('store');
  const {
    redemptions,
    loading: redemptionsLoading,
    error: redemptionsError,
    refresh: refreshRedemptions,
  } = useRedemptions();

  // 累计兑换件数 = 所有兑换记录的数量之和；累计消耗积分 = 单价 × 数量
  const totalItems = useMemo(
    () => redemptions.reduce((sum, record) => sum + (record.quantity ?? 1), 0),
    [redemptions],
  );
  const totalSpent = useMemo(
    () => redemptions.reduce((sum, record) => sum + (record.cost ?? 0) * (record.quantity ?? 1), 0),
    [redemptions],
  );

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <Header variant="student" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* 积分卡片：深色渐变背景 */}
        <section className="animate-fade-up relative overflow-hidden rounded-xl bg-gradient-to-br from-ink-950 via-ink-900 to-brand-800 p-6 text-white shadow-soft sm:p-8">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm text-white/60">你好，{profile?.name ?? '同学'}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold tracking-tight">
                  {formatPoints(profile?.points ?? 0)}
                </span>
                <span className="text-sm text-white/70">当前可用积分</span>
              </div>
              <p className="mt-3 text-xs text-white/50">用积分兑换心仪的物品吧</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <Gift className="h-8 w-8 text-brand-300" />
            </div>
          </div>
        </section>

        {/* 统计数据 */}
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            icon={ShoppingBag}
            value={redemptionsLoading ? '…' : String(totalItems)}
            label="已兑换商品（件）"
            tone="brand"
            delay={60}
          />
          <StatCard
            icon={Coins}
            value={redemptionsLoading ? '…' : formatPoints(totalSpent)}
            label="累计消耗积分"
            tone="accent"
            delay={120}
          />
        </section>

        {/* 标签切换 */}
        <nav className="inline-flex items-center gap-1 rounded-full bg-ink-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-ink-950 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* 面板内容 */}
        {activeTab === 'store' && <StorePanel onRedeemed={() => void refreshRedemptions()} />}
        {activeTab === 'history' && (
          <RedemptionsPanel
            redemptions={redemptions}
            loading={redemptionsLoading}
            error={redemptionsError}
            onRetry={() => void refreshRedemptions()}
          />
        )}
        {activeTab === 'ledger' && <LedgerPanel />}
        {activeTab === 'leaderboard' && <LeaderboardPanel />}
      </main>

      <Footer />
    </div>
  );
}
