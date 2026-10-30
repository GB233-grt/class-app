/**
 * 认证上下文：会话管理 + 当前用户资料
 * 登录/登出/重置密码全部走后端 /api/auth/* 接口（后端代理 Supabase Auth），
 * 前端不直连 supabase.co，保证在网络受限环境下依然可用
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
import { clearSession, readSession, writeSession } from '../lib/session';
import type { Student } from '../types';

interface AuthContextValue {
  /** 当前登录用户资料（null = 未登录） */
  profile: Student | null;
  /** 首次会话探测是否进行中 */
  initializing: boolean;
  /** 邮箱密码登录（turnstileToken 为 Cloudflare 人机验证令牌，启用时必传） */
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>;
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

  const loadProfile = useCallback(async (): Promise<Student | null> => {
    try {
      const me = await authApi.me();
      setProfile(me);
      return me;
    } catch {
      // 令牌失效或资料缺失：清除本地会话，回到未登录状态
      clearSession();
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 启动时从本地存储恢复会话
    void (async () => {
      if (readSession()) {
        await loadProfile();
      }
      if (mounted) {
        setInitializing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string, turnstileToken?: string) => {
      const result = await authApi.login(email, password, turnstileToken);
      if (!result?.access_token || !result?.refresh_token) {
        throw new Error('登录失败：服务器未返回有效会话');
      }
      writeSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      });
      const me = await loadProfile();
      if (!me) {
        // 登录成功但 students 表没有对应资料（种子数据未执行）
        throw new Error('登录成功，但系统中没有该账号的学生资料，请联系管理员核对');
      }
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 服务端吊销失败不影响本地登出
    }
    clearSession();
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await authApi.resetPassword(email);
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
