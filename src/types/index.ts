/**
 * 前端共享类型定义
 * 与数据库表结构（database/migrations）及后端 functions/lib/types.ts 保持一致
 */

/** 用户角色 */
export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

/** 学生/教师/管理员资料（students 表） */
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

/** 区域授权（用户 ↔ 区域） */
export interface RegionMember {
  user_id: string;
  region_id: string;
  created_at: string;
  students: { name: string; email: string; role: UserRole } | null;
  regions: { name: string; type: string } | null;
}

/** 修改密码请求参数 */
export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/** 更新资料请求参数 */
export interface UpdateProfilePayload {
  name?: string;
  student_no?: string;
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
  type: ItemType;
  publish_date: string | null;
  download_url: string | null;
  download_limit: number;
  /** 到期时间（null = 永不过期），到期后自动下架 */
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 发放状态 */
export type FulfillmentStatus = 'pending' | 'fulfilled';

/** 商品类型 */
export type ItemType = 'physical' | 'digital';

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
  /** 网络商品下载链接（兑换时的快照） */
  download_url: string | null;
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

/** 排行榜条目（GET /api/leaderboard，仅公开字段） */
export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
}

/** 添加商品请求体 */
export interface CreateItemPayload {
  name: string;
  description?: string | null;
  cost: number;
  stock: number;
  image_url?: string | null;
  /** 商品类型：physical=实物商品，digital=网络商品 */
  type: ItemType;
  /** 发布日期（网络商品） */
  publish_date?: string | null;
  /** 下载链接（网络商品） */
  download_url?: string | null;
  /** 下载次数限制，0=不限制（网络商品） */
  download_limit?: number;
  /** 上架状态：false 表示先放进「已下架」分组（不传默认 true 上架） */
  is_active?: boolean;
  /** 到期时间（ISO 字符串；不传或 null 表示永不过期） */
  expires_at?: string | null;
}

/** 创建用户请求体（支持角色选择：学生/教师） */
export interface CreateStudentPayload {
  name: string;
  student_no?: string | null;
  email: string;
  password: string;
  points: number;
  role?: 'student' | 'teacher';
  /** 所属区域（超管创建时必须指定；区域管理员只能填自己授权范围内的区域） */
  region_id?: string;
}

/** 积分增减请求体 */
export interface AwardPayload {
  student_id: string;
  delta: number;
  reason: string;
}

/** 批量加分请求体（判断公式 + 每行判断值） */
export interface AwardBatchPayload {
  /** 判断公式，如 `value >= 90 ? 10 : value >= 80 ? 5 : 0` */
  expression: string;
  reason: string;
  rows: { student_id: string; value: number }[];
}

/** 批量加分单学生结果 */
export interface AwardBatchResultItem {
  student_id: string;
  delta: number;
  balance_after: number;
}

/** 批量加分响应 */
export interface AwardBatchResponse {
  awarded: number;
  reason: string;
  results: AwardBatchResultItem[];
  /** 公式结果为 0、未变更的学生 */
  skipped: { student_id: string; message: string }[];
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
