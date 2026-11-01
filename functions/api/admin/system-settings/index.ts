/**
 * GET/POST /api/admin/system-settings —— 系统级配置管理（仅管理员）
 *   GET  → 全部配置列表
 *   POST → 更新/新增某项配置（白名单校验）
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

/** 允许通过接口修改的配置键（白名单，防止任意写入） */
const ALLOWED_KEYS = ['allow_profile_edit'] as const;

interface SettingsBody {
  key: string;
  value: Record<string, unknown>;
  description?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireAdmin(env, request);
  const { data, error } = await createAdminClient(env)
    .from('system_settings')
    .select('key, value, description, created_at, updated_at')
    .order('key');

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }
  return jsonResponse(
    (data ?? []).map((item) => ({
      key: item.key,
      value: parseValue(item.value),
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
  );
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await requireAdmin(env, request);
  const body = await readJson<SettingsBody>(request);

  requireString(body.key, '配置键名');
  if (!ALLOWED_KEYS.includes(body.key as (typeof ALLOWED_KEYS)[number])) {
    throw new HttpError(400, '不支持的配置项');
  }
  if (typeof body.value !== 'object' || body.value === null) {
    throw new HttpError(400, '配置值格式不正确');
  }

  const client = createAdminClient(env);
  const { error } = await client.from('system_settings').upsert(
    {
      key: body.key,
      value: JSON.stringify(body.value),
      description: body.description ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }

  const { data, error: readError } = await client
    .from('system_settings')
    .select('key, value, description, created_at, updated_at')
    .eq('key', body.key)
    .maybeSingle();

  if (readError || !data) {
    throw new HttpError(500, translateDbError(readError?.message ?? '保存后读取配置失败'));
  }
  return jsonResponse({
    key: data.key,
    value: parseValue(data.value),
    description: data.description,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
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
