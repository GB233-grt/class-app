/**
 * Supabase 客户端工厂（Workers 环境无持久会话需求）
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http';
import type { Env } from './types';

/** 匿名客户端：仅用于登录等认证端点（不携带用户 JWT） */
export function createAnonClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** 用户级客户端：携带用户 JWT 发起请求，受行级安全（RLS）约束 */
export function createUserClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** 服务级客户端：SERVICE_ROLE 密钥，绕过 RLS，仅用于管理操作（添加商品、创建学生等） */
export function createAdminClient(env: Env): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, '服务端缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量配置');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
