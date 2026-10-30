/**
 * 教师仪表盘：侧边栏导航（教学工具）+ 欢迎横幅 + 面板
 */
import { useEffect, useState } from 'react';
import { Award, ClipboardList, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { SidebarLayout, type SidebarNavGroup } from '../components/layout/SidebarLayout';
import { FulfillmentPanel } from '../components/feature/teacher/FulfillmentPanel';
import { AwardPointsPanel } from '../components/feature/teacher/AwardPointsPanel';
import { BulkAwardPanel } from '../components/feature/teacher/BulkAwardPanel';
import { redemptionsApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import type { StaffRedemption } from '../types';

type TeacherTabKey = 'fulfillment' | 'award' | 'bulk-award';

const GROUPS: SidebarNavGroup[] = [
  {
    title: '教学工具',
    items: [
      { key: 'fulfillment', label: '兑换发放', icon: ClipboardList },
      { key: 'award', label: '学生加分', icon: Award },
      { key: 'bulk-award', label: '批量加分', icon: FileSpreadsheet },
    ],
  },
];

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TeacherTabKey>('fulfillment');

  // 侧边栏「最近兑换」与待发放计数（发放面板内部另有独立数据源）
  const [staffRedemptions, setStaffRedemptions] = useState<StaffRedemption[]>([]);

  useEffect(() => {
    let cancelled = false;
    redemptionsApi
      .listForStaff()
      .then((data) => {
        if (!cancelled) setStaffRedemptions(data);
      })
      .catch(() => {
        // 侧边栏记录区容忍失败，主面板数据不受影响
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = staffRedemptions.filter((record) => record.status === 'pending').length;

  return (
    <SidebarLayout
      groups={GROUPS}
      activeKey={activeTab}
      onNavigate={(key) => setActiveTab(key as TeacherTabKey)}
      feature={{
        title: '兑换发放队列',
        description: `${pendingCount} 件兑换待发放`,
        cta: '去处理',
        onCta: () => setActiveTab('fulfillment'),
      }}
      history={{
        title: '最近兑换',
        items: staffRedemptions.slice(0, 4).map((record) => ({
          id: record.id,
          text: `${record.students?.name ?? '未知学生'} · ${record.item_name}${(record.quantity ?? 1) > 1 ? ` ×${record.quantity}` : ''}`,
        })),
        onViewAll: () => setActiveTab('fulfillment'),
      }}
    >
      <div className="space-y-6">
        {/* 欢迎横幅 */}
        <section className="animate-fade-up relative overflow-hidden rounded-xl bg-gradient-to-br from-ink-950 via-ink-900 to-brand-800 p-6 text-white shadow-soft sm:p-8">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm text-white/60">你好，{profile?.name ?? '老师'}</p>
              <h1 className="mt-2 font-display text-2xl font-bold leading-snug sm:text-3xl">
                兑换物品待线下发放，课堂表现即时加分
              </h1>
              <p className="mt-2 text-sm text-white/60">
                学生兑换后请核对名单并当面发放物品，确认后标记「已发放」。
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <GraduationCap className="h-8 w-8 text-brand-300" />
            </div>
          </div>
        </section>

        {/* 面板内容 */}
        {activeTab === 'fulfillment' && <FulfillmentPanel />}
        {activeTab === 'award' && <AwardPointsPanel />}
        {activeTab === 'bulk-award' && <BulkAwardPanel />}
      </div>
    </SidebarLayout>
  );
}
