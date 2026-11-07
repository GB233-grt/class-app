/**
 * 学生仪表盘：侧边栏导航（积分商店 / 我的记录）+ 积分卡片 + 统计 + 面板
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Gift, ReceiptText, ScrollText, Settings, ShoppingBag, Trophy } from 'lucide-react';
import { SidebarLayout, type SidebarNavGroup } from '../components/layout/SidebarLayout';
import { StatCard } from '../components/feature/StatCard';
import { StorePanel } from '../components/feature/student/StorePanel';
import { RedemptionsPanel } from '../components/feature/student/RedemptionsPanel';
import { LedgerPanel } from '../components/feature/student/LedgerPanel';
import { LeaderboardPanel } from '../components/feature/student/LeaderboardPanel';
import { SettingsPanel } from '../components/feature/settings/SettingsPanel';
import { userApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useRedemptions } from '../hooks/useRedemptions';
import { formatPoints } from '../lib/utils';

type StudentTabKey = 'store' | 'history' | 'ledger' | 'leaderboard' | 'settings';

const GROUPS: SidebarNavGroup[] = [
  {
    title: '积分商店',
    items: [{ key: 'store', label: '兑换商品', icon: ShoppingBag }],
  },
  {
    title: '我的记录',
    items: [
      { key: 'history', label: '兑换记录', icon: ReceiptText },
      { key: 'ledger', label: '积分明细', icon: ScrollText },
      { key: 'leaderboard', label: '排行榜', icon: Trophy },
    ],
  },
  {
    title: '我的账户',
    items: [{ key: 'settings', label: '设置', icon: Settings }],
  },
];

export default function StudentDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<StudentTabKey>('store');
  const {
    redemptions,
    loading: redemptionsLoading,
    error: redemptionsError,
    hasMore: redemptionsHasMore,
    loadingMore: redemptionsLoadingMore,
    loadMore: loadMoreRedemptions,
    refresh: refreshRedemptions,
  } = useRedemptions();

  // 累计兑换件数 / 消耗积分：由数据库聚合，避免只统计到已加载的分页
  const [summary, setSummary] = useState<{ total_items: number; total_spent: number } | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await userApi.summary());
    } catch {
      // 汇总失败不阻塞页面，退回按已加载记录估算
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const totalItems = useMemo(
    () => summary?.total_items ?? redemptions.reduce((sum, record) => sum + (record.quantity ?? 1), 0),
    [summary, redemptions],
  );
  const totalSpent = useMemo(
    () =>
      summary?.total_spent ??
      redemptions.reduce((sum, record) => sum + (record.cost ?? 0) * (record.quantity ?? 1), 0),
    [summary, redemptions],
  );

  // 设置页不需要侧边栏的特色/历史卡片
  const isSettings = activeTab === 'settings';

  return (
    <SidebarLayout
      groups={GROUPS}
      activeKey={activeTab}
      onNavigate={(key) => setActiveTab(key as StudentTabKey)}
      feature={isSettings ? undefined : {
        title: '积分排行榜',
        description: '看看你在全校排第几名',
        cta: '查看排行',
        onCta: () => setActiveTab('leaderboard'),
      }}
      history={isSettings ? undefined : {
        title: '最近兑换',
        items: redemptions.slice(0, 4).map((record) => ({
          id: record.id,
          text: `${record.item_name}${(record.quantity ?? 1) > 1 ? ` ×${record.quantity}` : ''} · ${record.cost * (record.quantity ?? 1)} 积分`,
        })),
        onViewAll: () => setActiveTab('history'),
      }}
    >
      <div className="space-y-6">
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

        {/* 面板内容 */}
        {activeTab === 'store' && (
          <StorePanel
            onRedeemed={() => {
              void refreshRedemptions();
              void loadSummary();
            }}
          />
        )}
        {activeTab === 'history' && (
          <RedemptionsPanel
            redemptions={redemptions}
            loading={redemptionsLoading}
            error={redemptionsError}
            onRetry={() => void refreshRedemptions()}
            hasMore={redemptionsHasMore}
            loadingMore={redemptionsLoadingMore}
            onLoadMore={() => void loadMoreRedemptions()}
          />
        )}
        {activeTab === 'ledger' && <LedgerPanel />}
        {activeTab === 'leaderboard' && <LeaderboardPanel />}
        {activeTab === 'settings' && profile && (
          <SettingsPanel profile={profile} onUpdated={() => void refreshProfile()} />
        )}
      </div>
    </SidebarLayout>
  );
}
