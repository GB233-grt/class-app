/**
 * Fetch 客户端：自动携带登录态（Bearer JWT），令牌过期时自动刷新，统一解析错误
 */
import { clearSession, readSession, writeSession, type SessionData } from '../lib/session';

const API_BASE = '/api';

/** API 请求错误（携带状态码与中文消息） */
export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

/** 判断是否为 API 客户端错误 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

/** 用刷新令牌换取新会话；失败时清除本地会话并返回 null */
async function refreshSession(refreshToken: string): Promise<SessionData | null> {
  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) {
      clearSession();
      return null;
    }
    const body = (await resp.json()) as Partial<SessionData>;
    if (!body.access_token || !body.refresh_token) {
      clearSession();
      return null;
    }
    const fresh: SessionData = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at ?? 0,
    };
    writeSession(fresh);
    return fresh;
  } catch {
    clearSession();
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // 附加当前登录用户的访问令牌
  const session = readSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const doFetch = (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, { ...options, headers }).catch(() => {
      throw new ApiClientError('网络请求失败，请检查网络连接', 0);
    });

  let response = await doFetch();

  // 访问令牌过期：用刷新令牌换新令牌后重试一次（auth 接口本身不重试，避免循环）
  if (response.status === 401 && session && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession(session.refresh_token);
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed.access_token}`;
      response = await doFetch();
    }
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message =
      (body !== null && typeof body === 'object' && 'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : undefined) ?? `请求失败（${response.status}）`;
    throw new ApiClientError(message, response.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
};
