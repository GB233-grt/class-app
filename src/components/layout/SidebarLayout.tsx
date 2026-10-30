/**
 * 侧边栏布局（三个仪表盘共用）：
 * 顶部 Logo + 分类导航 + 特色卡片 + 最近记录 + 底部黑色操作栏（头像/系统消息/帮助/登出）
 * 桌面端：固定左栏，可折叠为图标列；移动端：顶栏 + 抽屉
 * 视觉：浅底、留白充足、蓝色系线框图标（品牌绿）、卡片化分区
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  CircleHelp,
  FileText,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { PROJECT_AUTHOR, SYSTEM_MESSAGES, USAGE_GUIDE } from '../../lib/constants';
import { cn } from '../../lib/utils';

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarNavGroup {
  title?: string;
  items: SidebarNavItem[];
}

interface SidebarLayoutProps {
  groups: SidebarNavGroup[];
  activeKey: string;
  onNavigate: (key: string) => void;
  /** 特色功能区（卡片 + 胶囊 CTA） */
  feature: {
    title: string;
    description?: string;
    cta: string;
    onCta: () => void;
  };
  /** 最近记录区 */
  history: {
    title: string;
    items: { id: string; text: string }[];
    onViewAll: () => void;
  };
  children: ReactNode;
}

type ModalKind = 'system' | 'help' | null;

const COLLAPSE_STORAGE_KEY = 'sidebar-collapsed';

interface SidebarContentProps {
  groups: SidebarNavGroup[];
  activeKey: string;
  onNavigate: (key: string) => void;
  feature: SidebarLayoutProps['feature'];
  history: SidebarLayoutProps['history'];
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** 移动端抽屉：右上角显示关闭按钮 */
  isMobile?: boolean;
}

function SidebarContent({
  groups,
  activeKey,
  onNavigate,
  feature,
  history,
  collapsed,
  onToggleCollapse,
  isMobile = false,
}: SidebarContentProps) {
  const { profile, logout } = useAuth();
  const [modal, setModal] = useState<ModalKind>(null);

  // 弹层打开时按 Esc 关闭
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const initial = (profile?.name ?? '学').slice(0, 1);

  const bottomButton =
    'rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white';

  return (
    <>
      {/* 顶部：Logo + 品牌名 + 收起/关闭按钮 */}
      <div
        className={cn(
          'border-b border-ink-100 px-3 py-4',
          collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2.5',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'justify-center')}>
          <img src="/rounded-image-96.png" alt="积分商城" className="h-9 w-9 shrink-0 rounded-lg" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-serif text-base font-bold leading-tight tracking-wide text-ink-900">
                积分商城
              </p>
              <p className="truncate text-[11px] text-ink-400">学生积分奖励平台</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isMobile ? '关闭菜单' : collapsed ? '展开侧边栏' : '收起侧边栏'}
          title={isMobile ? '关闭菜单' : collapsed ? '展开侧边栏' : '收起侧边栏'}
          className={cn(
            'rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900',
            !collapsed && !isMobile && 'ml-auto',
          )}
        >
          {isMobile ? (
            <X className="h-4 w-4" />
          ) : collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 功能导航列表 */}
      <nav className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        {groups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`} className="mb-4">
            {group.title && !collapsed && (
              <p className="px-2.5 pb-1.5 text-xs font-medium text-ink-400">{group.title}</p>
            )}
            {group.title && collapsed && groupIndex > 0 && (
              <div className="mx-1 mb-2 border-t border-ink-100" aria-hidden="true" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeKey === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg text-sm transition-colors',
                        collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2',
                        active
                          ? 'bg-brand-50 font-medium text-brand-700'
                          : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                      )}
                    >
                      <item.icon
                        className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-600' : 'text-ink-400')}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 特色功能区：卡片 + 胶囊 CTA */}
      {!collapsed && (
        <div className="px-3 pb-4">
          <div className="rounded-xl border border-ink-100 bg-gradient-to-br from-ink-50 to-white p-3.5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-white text-brand-600 shadow-sm">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{feature.title}</p>
                {feature.description && (
                  <p className="truncate text-xs text-ink-400">{feature.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={feature.onCta}
                className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
              >
                {feature.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 最近记录区 */}
      {!collapsed && (
        <div className="border-t border-ink-100 px-3 py-3">
          <p className="flex items-center gap-1.5 px-1.5 pb-2 text-xs font-medium text-ink-400">
            <History className="h-3.5 w-3.5" />
            {history.title}
          </p>
          {history.items.length > 0 ? (
            <>
              <ul className="space-y-0.5">
                {history.items.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={history.onViewAll}
                      title={item.text}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-ink-50"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                      <span className="truncate text-sm text-ink-700">{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={history.onViewAll}
                className="mt-1.5 px-1.5 text-xs font-medium text-brand-600 underline-offset-4 hover:underline"
              >
                查看全部
              </button>
            </>
          ) : (
            <p className="px-1.5 text-xs text-ink-400">暂无记录</p>
          )}
        </div>
      )}

      {/* 底部操作栏：纯黑背景 + 头像 + 白色线框图标 */}
      <div
        className={cn(
          'flex items-center gap-1.5 border-t border-ink-800 bg-ink-950 px-3 py-3',
          collapsed && 'flex-col gap-2',
        )}
      >
        <div
          title={profile?.name}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-ink-950',
            collapsed && 'mx-auto',
          )}
        >
          {initial}
        </div>
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'ml-auto items-center')}>
          <button type="button" onClick={() => setModal('system')} aria-label="系统消息" title="系统消息" className={bottomButton}>
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setModal('help')} aria-label="帮助" title="帮助" className={bottomButton}>
            <CircleHelp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定要退出登录吗？')) void logout();
            }}
            aria-label="退出登录"
            title="退出登录"
            className={cn(bottomButton, 'hover:bg-red-500/20 hover:text-red-300')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* 弹层：系统消息 / 帮助 */}
        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'system' ? '系统消息' : '帮助'}
          >
            <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setModal(null)} />
            <div className="animate-fade-up relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink-900">
                  {modal === 'system' ? '系统消息' : '帮助'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  aria-label="关闭"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {modal === 'system' ? (
                <ul className="space-y-3">
                  {SYSTEM_MESSAGES.map((message) => (
                    <li key={message.title} className="rounded-lg bg-ink-50 px-4 py-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                        {message.title}
                      </p>
                      <p className="mt-1 pl-3.5 text-sm leading-relaxed text-ink-500">
                        {message.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-brand-50 px-4 py-3">
                    <p className="text-sm font-medium text-ink-900">项目作者</p>
                    <p className="mt-1 text-sm text-ink-600">{PROJECT_AUTHOR}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink-900">使用方法</p>
                    <div className="space-y-3">
                      {USAGE_GUIDE.map((section) => (
                        <div key={section.role} className="rounded-lg bg-ink-50 px-4 py-3">
                          <p className="text-sm font-medium text-ink-900">{section.role}</p>
                          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-600">
                            {section.points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function SidebarLayout({ groups, activeKey, onNavigate, feature, history, children }: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // 忽略隐私模式下的存储失败
      }
      return next;
    });
  };

  const navigate = (key: string) => {
    setMobileOpen(false);
    onNavigate(key);
  };

  return (
    <div className="min-h-screen bg-ink-50">
      {/* 移动端顶栏 */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-100 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <img src="/rounded-image-96.png" alt="积分商城" className="h-8 w-8 rounded-lg" />
        <span className="font-serif text-base font-bold tracking-wide text-ink-900">积分商城</span>
      </div>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <SidebarContent
              groups={groups}
              activeKey={activeKey}
              onNavigate={navigate}
              feature={feature}
              history={history}
              collapsed={false}
              onToggleCollapse={() => setMobileOpen(false)}
              isMobile
            />
          </aside>
        </div>
      )}

      <div className="flex">
        {/* 桌面端侧边栏 */}
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-100 bg-white transition-[width] duration-200 lg:flex',
            collapsed ? 'w-[76px]' : 'w-72',
          )}
        >
          <SidebarContent
            groups={groups}
            activeKey={activeKey}
            onNavigate={navigate}
            feature={feature}
            history={history}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
        </aside>

        {/* 主内容区 */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
