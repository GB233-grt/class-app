/**
 * Supabase 客户端（浏览器端）
 * 负责认证会话（登录/登出/重置密码）；业务数据一律通过 /api 后端接口读写
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** 是否已完成 Supabase 环境变量配置（用于页面给出友好提示） */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[积分商城] 尚未配置 Supabase 环境变量：请复制 .env.example 为 .env，' +
      '并填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY（详见 README）。',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
