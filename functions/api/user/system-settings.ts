/**
 * GET /api/user/system-settings —— 读取对普通用户可见的系统配置（只读）
 * 仅返回白名单中的、与用户体验相关的配置项，不暴露其他系统配置。
 */
import { HttpError, jsonResponse, translateDbError } from '../../lib/http';
import { requireAuth } from '../../lib/auth';
import { createAdminClient } from '../../lib/supabase';
import type { Env } from '../../lib/types';

/** 普通用户可见的配置键 */
const PUBLIC_KEYS = ['allow_profile_edit'] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireAuth(env, request);

  const { data, error } = await createAdminClient(env)
    .from('system_settings')
    .select('key, value, description')
    .in('key', PUBLIC_KEYS as unknown as string[]);

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }

  return jsonResponse(
    (data ?? []).map((item) => ({
      key: item.key,
      value: parseValue(item.value),
      description: item.description,
    })),
  );
};

/** 安全解析 JSON 字符串配置值 */
function parseValue(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
