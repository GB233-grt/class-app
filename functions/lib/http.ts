/**
 * HTTP 工具：统一响应格式、错误类型与请求体校验
 * 所有 API 路由通过抛出 HttpError 交由中间件统一转换为 JSON 响应
 */

/** 允许跨域的响应头（同域部署下主要服务于本地 Vite 代理调试） */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

/** 业务错误：携带 HTTP 状态码 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** 成功响应 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** 错误响应：统一为 { error: string } */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/** 解析 JSON 请求体 */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, '请求体格式错误');
  }
}

/** 分页默认值与上限（列表接口统一口径，避免静默截断） */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * 解析分页参数：?limit=&offset=
 * 非法值一律回落到默认值，limit 最大 100，offset 不允许为负。
 */
export function parsePagination(
  url: URL,
  defaultLimit = DEFAULT_PAGE_SIZE,
): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get('limit') ?? defaultLimit);
  const rawOffset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_PAGE_SIZE)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
  return { limit, offset };
}

/** 统一的分页响应体 */
export function pagedResponse<T>(items: T[], hasMore: boolean): Response {
  return jsonResponse({ items, has_more: hasMore });
}

/** 必填字符串校验 */
export function requireString(
  value: unknown,
  field: string,
  opts: { max?: number } = {},
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${field}不能为空`);
  }
  const trimmed = value.trim();
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw new HttpError(400, `${field}不能超过 ${opts.max} 个字`);
  }
  return trimmed;
}

/** 可选字符串校验：空值返回 null */
export function optionalString(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, '字段格式错误');
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new HttpError(400, `内容不能超过 ${max} 个字`);
  return trimmed;
}

/** 必填整数校验 */
export function requireInt(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number } = {},
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(num) || !Number.isInteger(num)) {
    throw new HttpError(400, `${field}必须是整数`);
  }
  if (opts.min !== undefined && num < opts.min) {
    throw new HttpError(400, `${field}不能小于 ${opts.min}`);
  }
  if (opts.max !== undefined && num > opts.max) {
    throw new HttpError(400, `${field}不能大于 ${opts.max}`);
  }
  return num;
}

/** 将数据库异常消息转换为用户可读的中文提示 */
export function translateDbError(message: string): string {
  if (message.includes('duplicate key')) return '数据已存在，请勿重复添加';
  if (message.includes('row-level security')) return '没有权限执行该操作';
  if (message.includes('violates check constraint')) {
    return '数据未通过字段校验，请确认已在 Supabase 执行最新的数据库升级脚本（migrations/07_teacher_and_fulfillment.sql）';
  }
  if (message.includes('adjust_student_points_batch') && message.includes('does not exist')) {
    return '数据库尚未升级：请在 Supabase SQL Editor 中执行 database/migrations/08_batch_points_adjust.sql 后重试';
  }
  // database/migrations/09_item_types.sql
  if (message.includes('items') && message.match(/type|download_url|download_limit/)) {
    return '数据库尚未升级：请在 Supabase SQL Editor 中执行 database/migrations/09_item_types.sql 后重试';
  }
  // database/migrations/10_system_settings.sql
  if (
    (message.includes('system_settings') || message.includes('relation')) &&
    (message.includes('does not exist') || message.includes('不存在'))
  ) {
    return '数据库尚未升级：请在 Supabase SQL Editor 中执行 database/migrations/10_system_settings.sql 后重试';
  }
  return message || '操作失败，请稍后重试';
}
