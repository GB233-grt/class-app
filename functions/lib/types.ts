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
  /** Cloudflare Turnstile 服务端验证密钥（可选，配置后登录强制人机校验） */
  TURNSTILE_SECRET_KEY?: string;
}

/** 角色：学生 / 教师 / 区域管理员 / 超级管理员 */
export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

/** 学生表行结构 */
export interface Student {
  id: string;
  name: string;
  student_no: string | null;
  email: string;
  role: UserRole;
  points: number;
  /** 所属区域（学生用）；为空表示未分区，仅超级管理员可见 */
  region_id: string | null;
  created_at: string;
}

/** 区域（校区 / 年级 / 班级，树形） */
export interface Region {
  id: string;
  name: string;
  type: 'campus' | 'grade' | 'class' | 'other';
  parent_id: string | null;
  created_at: string;
}

/** 商品表行结构（type: physical=实物商品，digital=网络商品） */
export interface Item {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  type: 'physical' | 'digital';
  publish_date: string | null;
  download_url: string | null;
  download_limit: number;
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
  /** 商品类型：physical=实物商品，digital=网络商品 */
  type: 'physical' | 'digital';
  /** 公共发布日期（网络商品） */
  publish_date?: string | null;
  /** 下载链接（网络商品） */
  download_url?: string | null;
  /** 下载次数限制（0=不限制）（网络商品） */
  download_limit?: number;
}

/** 创建学生请求体 */
export interface CreateStudentPayload {
  name: string;
  student_no?: string | null;
  email: string;
  password: string;
  points: number;
  /** 角色：学生或教师（管理员只能通过种子数据创建） */
  role?: 'student' | 'teacher';
}

/** 兑换请求体 */
export interface RedeemPayload {
  item_id: string;
  /** 兑换数量（1~99） */
  quantity?: number;
}

/** 发放状态 */
export type FulfillmentStatus = 'pending' | 'fulfilled';

/** 兑换记录行结构（与数据库 redemptions 表一致） */
export interface Redemption {
  id: string;
  student_id: string;
  item_id: string;
  item_name: string;
  cost: number;
  quantity: number;
  status: FulfillmentStatus;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  /** 网络商品下载链接（兑换时的快照） */
  download_url: string | null;
  created_at: string;
}

/** 教职工视角的兑换记录（关联学生姓名） */
export interface StaffRedemption extends Redemption {
  students: { name: string; student_no: string | null } | null;
}

/** 积分增减请求体 */
export interface AwardPayload {
  student_id: string;
  delta: number;
  reason: string;
}
