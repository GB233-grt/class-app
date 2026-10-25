/**
 * API 接口定义（与 Cloudflare Pages Functions 路由一一对应）
 */
import { api } from './client';
import type {
  AwardPayload,
  AwardResponse,
  CreateItemPayload,
  CreateStudentPayload,
  FulfillmentStatus,
  Item,
  LedgerEntry,
  RedeemResponse,
  Redemption,
  StaffRedemption,
  Stats,
  Student,
} from '../types';

/** 登录接口返回的会话数据 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

/** 认证相关（全部经后端代理 Supabase Auth，前端不直连 supabase.co） */
export const authApi = {
  /** 获取当前登录用户资料 */
  me: () => api.get<Student>('/auth/me'),
  /** 邮箱密码登录 */
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  /** 登出（服务端吊销令牌 + 前端清除本地会话） */
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
  /** 发送密码重置邮件 */
  resetPassword: (email: string, redirectTo?: string) =>
    api.post<{ success: boolean }>('/auth/reset-password', {
      email,
      redirect_to: redirectTo ?? window.location.origin,
    }),
};

/** 商品（物品）管理 */
export const itemsApi = {
  /** 商品列表：学生仅见上架商品，管理员见全部 */
  list: () => api.get<Item[]>('/items'),
  /** 添加商品（管理员） */
  create: (payload: CreateItemPayload) => api.post<Item>('/items', payload),
  /** 编辑商品（管理员）：名称/描述/价格/库存/图片 */
  update: (id: string, payload: CreateItemPayload) => api.put<Item>(`/items/${id}`, payload),
  /** 删除商品（管理员，软删除下架） */
  remove: (id: string) => api.delete<{ message: string }>(`/items/${id}`),
};

/** 学生管理（教师/管理员） */
export const studentsApi = {
  /** 用户列表（教师/管理员可见） */
  list: () => api.get<Student[]>('/students'),
  /** 创建用户（管理员，支持角色选择） */
  create: (payload: CreateStudentPayload) => api.post<Student>('/students', payload),
  /** 积分增减（教师/管理员） */
  award: (payload: AwardPayload) => api.post<AwardResponse>('/students/award', payload),
};

/** 物品兑换 */
export const redemptionsApi = {
  /** 兑换商品（支持数量选择） */
  redeem: (itemId: string, quantity = 1) =>
    api.post<RedeemResponse>('/redemptions', { item_id: itemId, quantity }),
  /** 查询某学生的兑换记录（本人或教职工） */
  listByStudent: (studentId: string) => api.get<Redemption[]>(`/redemptions/${studentId}`),
  /** 教职工：全部兑换记录（教师工作台发放队列，可按状态筛选） */
  listForStaff: (status?: FulfillmentStatus) =>
    api.get<StaffRedemption[]>(`/redemptions${status ? `?status=${status}` : ''}`),
  /** 教职工：更新发放状态（标记已发放 / 撤回为待发放） */
  updateStatus: (id: string, status: FulfillmentStatus) =>
    api.post<{ id: string; status: FulfillmentStatus }>(`/redemptions/${id}/status`, { status }),
};

/** 积分明细 */
export const ledgerApi = {
  /** 查询某学生的积分流水 */
  listByStudent: (studentId: string) => api.get<LedgerEntry[]>(`/ledger/${studentId}`),
};

/** 管理员统计 */
export const statsApi = {
  get: () => api.get<Stats>('/stats'),
};
