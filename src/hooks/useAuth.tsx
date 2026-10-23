/**
 * 认证上下文：会话管理 + 当前用户资料
 * 登录/登出/重置密码通过 Supabase Auth SDK；资料读取走后端 /api/auth/me
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateAuthError } from '../lib/utils';
import type { Student } from '../types';

interface AuthContextValue {
  /** 当前登录用户资料（null = 未登录） */
  profile: Student | null;
  /** 首次会话探测是否进行中 */
  initializing: boolean;
  /** 邮箱密码登录 */
  login: (email: string, password: string) => Promise<void>;
  /** 登出 */
  logout: () => Promise<void>;
  /** 发送密码重置邮件 */
  sendPasswordReset: (email: string) => Promise<void>;
  /** 刷新当前用户资料（积分变动后调用） */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Student | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const me = await authApi.me();
      setProfile(me);
    } catch {
      // 令牌失效或资料缺失：统一回到未登录状态
      await supabase.auth.signOut();
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 启动时恢复持久化会话
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await loadProfile();
      }
      if (mounted) {
        setInitializing(false);
      }
    })();

    // 监听登出事件
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        throw new Error('尚未配置 Supabase 环境变量，请参考 README 完成 .env 配置');
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(translateAuthError(error.message));
      }
      await loadProfile();
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const value = useMemo(
    () => ({ profile, initializing, login, logout, sendPasswordReset, refreshProfile }),
    [profile, initializing, login, logout, sendPasswordReset, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return ctx;
}
