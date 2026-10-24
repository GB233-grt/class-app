/**
 * 本地会话存储
 * 令牌保存在浏览器 localStorage；所有接口请求经 /api 后端代理，前端不直连 Supabase，
 * 保证在网络受限（supabase.co 不可达）的环境下登录与业务功能依然可用
 */
const SESSION_KEY = 'spe_session';

export interface SessionData {
  /** 访问令牌（JWT，调用后端接口时携带） */
  access_token: string;
  /** 刷新令牌（访问令牌过期后用于换取新令牌） */
  refresh_token: string;
  /** 访问令牌过期时间（Unix 秒） */
  expires_at?: number;
}

/** 读取本地会话（不存在或无效时返回 null） */
export function readSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (!data?.access_token || !data?.refresh_token) return null;
    return data;
  } catch {
    return null;
  }
}

/** 写入本地会话 */
export function writeSession(session: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 存储不可用（隐私模式等）：忽略，不影响本次会话
  }
}

/** 清除本地会话（登出 / 令牌失效） */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
