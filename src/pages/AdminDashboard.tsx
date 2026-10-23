/**
 * 管理员仪表盘：统计概览 + 商品管理/学生管理/新建学生
 */
import { useState } from 'react';
import { Boxes, Coins, Package, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatCard } from '../components/feature/StatCard';
import { ItemsPanel } from '../components/feature/admin/ItemsPanel';
import { StudentsPanel } from '../components/feature/admin/StudentsPanel';
import { CreateStudentPanel } from '../components/feature/admin/CreateStudentPanel';
import { useStats } from '../hooks/useStats';
import { cn, formatPoints } from '../lib/utils';

type AdminTabKey = 'items' | 'students' | 'create';

const TABS: { key: AdminTabKey; label: string; icon: LucideIcon }[] = [
  { key: 'items', label: '商品管理', icon: Package },
  { key: 'students', label: '学生管理', icon: Users },
  { key: 'create', label: '新建学生', icon: UserPlus },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('items');
  const { stats, loading: statsLoading } = useStats();

  return (
    <div className="min-h-screen bg-ink-50">
      {/* 深色顶部导航栏 */}
      <Header variant="admin" />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* 统计概览卡片 */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Package}
            value={statsLoading ? '…' : String(stats?.item_count ?? '—')}
            label="商品目录数量"
            tone="brand"
            delay={0}
          />
          <StatCard
            icon={Boxes}
            value={statsLoading ? '…' : formatPoints(stats?.total_stock ?? 0)}
            label="总库存单位数"
            tone="ink"
            delay={60}
          />
          <StatCard
            icon={Coins}
            value={statsLoading ? '…' : formatPoints(stats?.total_awarded ?? 0)}
            label="发放给学生总积分"
            tone="accent"
            delay={120}
          />
        </section>

        {/* 标签切换：圆角胶囊，激活态深色背景白色文字 */}
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
        {activeTab === 'items' && <ItemsPanel />}
        {activeTab === 'students' && <StudentsPanel />}
        {activeTab === 'create' && <CreateStudentPanel />}
      </main>
    </div>
  );
}
