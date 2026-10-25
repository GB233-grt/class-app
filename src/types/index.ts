/**
 * 前端共享类型定义
 * 与数据库表结构（database/migrations）及后端 functions/lib/types.ts 保持一致
 */

/** 用户角色 */
export type UserRole = 'student' | 'teacher' | 'admin';

/** 学生/教师/管理员资料（students 表） */
export interface Student {
  id: string;
  name: string;
  student_no: string | null;
  email: string;
  role: UserRole;
  points: number;
  created_at: string;
}

/** 商品/物品（items 表） */
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

/** 发放状态 */
export type FulfillmentStatus = 'pending' | 'fulfilled';

/** 兑换记录（redemptions 表） */
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
  created_at: string;
}

/** 教职工视角的兑换记录（关联学生姓名，用于教师工作台） */
export interface StaffRedemption extends Redemption {
  students: { name: string; student_no: string | null } | null;
}

/** 积分明细（points_ledger 表） */
export interface LedgerEntry {
  id: string;
  student_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  actor_id: string | null;
  created_at: string;
}

/** 管理员统计概览（GET /api/stats） */
export interface Stats {
  item_count: number;
  total_stock: number;
  total_awarded: number;
  student_count: number;
}

/** 添加商品请求体 */
export interface CreateItemPayload {
  name: string;
  description?: string | null;
  cost: number;
  stock: number;
  image_url?: string | null;
}

/** 创建用户请求体（支持角色选择：学生/教师） */
export interface CreateStudentPayload {
  name: string;
  student_no?: string | null;
  email: string;
  password: string;
  points: number;
  role?: 'student' | 'teacher';
}

/** 积分增减请求体 */
export interface AwardPayload {
  student_id: string;
  delta: number;
  reason: string;
}

/** 兑换成功响应 */
export interface RedeemResponse {
  message: string;
  redemption_id: string;
  balance_after: number;
}

/** 积分增减响应 */
export interface AwardResponse {
  student_id: string;
  delta: number;
  reason: string;
  balance_after: number;
}

/** API 错误响应体 */
export interface ApiErrorBody {
  error: string;
}
