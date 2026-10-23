/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 项目 URL（前端使用） */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase 匿名密钥（前端使用） */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
