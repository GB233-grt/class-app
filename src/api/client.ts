/**
 * Fetch 客户端：自动携带登录态（Bearer JWT），统一解析错误
 */
import { supabase } from '../lib/supabase';

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // 附加当前登录用户的访问令牌
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiClientError('网络请求失败，请检查网络连接', 0);
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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
