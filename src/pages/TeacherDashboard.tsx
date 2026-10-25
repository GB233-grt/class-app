/**
 * 教师仪表盘：兑换发放确认 + 学生加分
 */
import { useState } from 'react';
import { Award, ClipboardList, GraduationCap, type LucideIcon } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FulfillmentPanel } from '../components/feature/teacher/FulfillmentPanel';
import { AwardPointsPanel } from '../components/feature/teacher/AwardPointsPanel';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

type TeacherTabKey = 'fulfillment' | 'award';

const TABS: { key: TeacherTabKey; label: string; icon: LucideIcon }[] = [
  { key: 'fulfillment', label: '兑换发放', icon: ClipboardList },
  { key: 'award', label: '学生加分', icon: Award },
];

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TeacherTabKey>('fulfillment');

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <Header variant="teacher" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
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
                学生兑换后请核对名单并当面发放物品，确认后在下方标记「已发放」。
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <GraduationCap className="h-8 w-8 text-brand-300" />
            </div>
          </div>
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
        {activeTab === 'fulfillment' && <FulfillmentPanel />}
        {activeTab === 'award' && <AwardPointsPanel />}
      </main>

      <Footer />
    </div>
  );
}
