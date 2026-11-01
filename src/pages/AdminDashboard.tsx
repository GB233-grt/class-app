/**
 * 管理员仪表盘：侧边栏导航（用户管理 / 商品与数据 / 系统）+ 统计概览 + 面板
 */
import { useMemo, useState } from 'react';
import { Boxes, Coins, Package, SlidersHorizontal, UserCog, UserPlus, Users } from 'lucide-react';
import { SidebarLayout, type SidebarNavGroup } from '../components/layout/SidebarLayout';
import { StatCard } from '../components/feature/StatCard';
import { ItemsPanel } from '../components/feature/admin/ItemsPanel';
import { StudentsPanel } from '../components/feature/admin/StudentsPanel';
import { CreateStudentPanel } from '../components/feature/admin/CreateStudentPanel';
import { SystemSettingsPanel } from '../components/feature/admin/SystemSettingsPanel';
import { SettingsPanel } from '../components/feature/settings/SettingsPanel';
import { useAuth } from '../hooks/useAuth';
import { useStats } from '../hooks/useStats';
import { useStudents } from '../hooks/useStudents';
import { formatPoints } from '../lib/utils';

type AdminTabKey = 'items' | 'students' | 'create' | 'system' | 'account';

const GROUPS: SidebarNavGroup[] = [
  {
    title: '用户管理',
    items: [
      { key: 'students', label: '学生管理', icon: Users },
      { key: 'create', label: '新建用户', icon: UserPlus },
    ],
  },
  {
    title: '商品与数据',
    items: [{ key: 'items', label: '商品管理', icon: Package }],
  },
  {
    title: '系统',
    items: [
      { key: 'system', label: '系统设置', icon: SlidersHorizontal },
      { key: 'account', label: '我的账户', icon: UserCog },
    ],
  },
];

export default function AdminDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTabKey>('items');
  const { stats, loading: statsLoading } = useStats();
  const { students } = useStudents();

  // 侧边栏「最近新增学生」：按创建时间倒序取前 4
  const recentStudents = useMemo(
    () => [...students].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4),
    [students],
  );

  // 系统设置与账户页不需要侧边栏的特色/历史卡片
  const hideSideCards = activeTab === 'system' || activeTab === 'account';

  return (
    <SidebarLayout
      groups={GROUPS}
      activeKey={activeTab}
      onNavigate={(key) => setActiveTab(key as AdminTabKey)}
      feature={
        hideSideCards
          ? undefined
          : {
              title: '商品目录',
              description: statsLoading
                ? '加载中…'
                : `${stats?.item_count ?? 0} 件商品 · 总库存 ${formatPoints(stats?.total_stock ?? 0)}`,
              cta: '管理商品',
              onCta: () => setActiveTab('items'),
            }
      }
      history={
        hideSideCards
          ? undefined
          : {
              title: '最近新增学生',
              items: recentStudents.map((student) => ({
                id: student.id,
                text: student.student_no
                  ? `${student.name}（${student.student_no}）`
                  : student.name,
              })),
              onViewAll: () => setActiveTab('students'),
            }
      }
    >
      <div className="space-y-6">
        {/* 统计概览卡片 */}
        {!hideSideCards && (
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
        )}

        {/* 面板内容 */}
        {activeTab === 'items' && <ItemsPanel />}
        {activeTab === 'students' && <StudentsPanel />}
        {activeTab === 'create' && <CreateStudentPanel />}
        {activeTab === 'system' && <SystemSettingsPanel />}
        {activeTab === 'account' && profile && (
          <SettingsPanel profile={profile} onUpdated={() => void refreshProfile()} />
        )}
      </div>
    </SidebarLayout>
  );
}
