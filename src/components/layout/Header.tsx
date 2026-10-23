/**
 * 顶部导航栏：学生端（浅色）/ 管理员端（深色）
 */
import { Coins, GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

interface HeaderProps {
  variant?: 'student' | 'admin';
}

export function Header({ variant = 'student' }: HeaderProps) {
  const { profile, logout } = useAuth();
  const isAdmin = variant === 'admin';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b',
        isAdmin ? 'border-ink-800 bg-ink-950 text-white' : 'border-ink-100 bg-white',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* 左侧：Logo 与标识 */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight">积分商城</span>
            {isAdmin ? (
              <span className="hidden truncate text-sm text-white/60 sm:inline">
                管理员控制台{profile ? ` · ${profile.name}` : ''}
              </span>
            ) : (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                学生商店
              </span>
            )}
          </div>
        </div>

        {/* 右侧：积分徽章与登出 */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isAdmin && (
            <span className="flex items-center gap-1.5 rounded-full bg-ink-950 px-3 py-1.5 text-sm font-semibold text-white">
              <Coins className="h-4 w-4 text-brand-400" />
              {profile?.points ?? 0} 积分
            </span>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isAdmin
                ? 'text-white/70 hover:bg-ink-800 hover:text-white'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      </div>
    </header>
  );
}
