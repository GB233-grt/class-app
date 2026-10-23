/**
 * 后端共享类型定义（Cloudflare Pages Functions）
 * 与前端 src/types/index.ts 保持一致
 */

/** Cloudflare Pages Functions 环境变量 */
export interface Env {
  /** Supabase 项目 URL */
  SUPABASE_URL: string;
  /** Supabase 匿名密钥（用户级请求使用） */
  SUPABASE_ANON_KEY: string;
  /** Supabase 服务角色密钥（管理操作使用，务必配置为 Secret） */
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/** 学生表行结构 */
export interface Student {
  id: string;
  name: string;
  student_no: string | null;
  email: string;
  role: 'student' | 'admin';
  points: number;
  created_at: string;
}

/** 商品表行结构 */
export interface Item {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 添加商品请求体 */
export interface CreateItemPayload {
  name: string;
  description?: string | null;
  cost: number;
  stock: number;
  image_url?: string | null;
}

/** 创建学生请求体 */
export interface CreateStudentPayload {
  name: string;
  student_no?: string | null;
  email: string;
  password: string;
  points: number;
}

/** 积分增减请求体 */
export interface AwardPayload {
  student_id: string;
  delta: number;
  reason: string;
}
