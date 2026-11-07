/**
 * API 接口定义（与 Cloudflare Pages Functions 路由一一对应）
 */
import { api } from './client';
import type {
  AwardBatchPayload,
  AwardBatchResponse,
  AwardPayload,
  AwardResponse,
  ChangePasswordPayload,
  CreateItemPayload,
  CreateStudentPayload,
  FulfillmentStatus,
  Item,
  LedgerEntry,
  LeaderboardEntry,
  Page,
  RedeemResponse,
  Redemption,
  Region,
  RegionMember,
  StaffRedemption,
  Stats,
  Student,
  UpdateProfilePayload,
  UserRole,
} from '../types';


/** 分页参数（默认 50 条，后端上限 100） */
export interface PageQuery {
  limit?: number;
  offset?: number;
  status?: FulfillmentStatus;
}

/** 拼查询串；不传则使用后端默认值 */
export function buildPageQuery(page: PageQuery = {}): string {
  const params = new URLSearchParams();
  if (page.limit !== undefined) params.set('limit', String(page.limit));
  if (page.offset !== undefined) params.set('offset', String(page.offset));
  if (page.status) params.set('status', page.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

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
  /** 修改登录密码（已登录态 + 旧密码确认） */
  changePassword: (payload: ChangePasswordPayload) =>
    api.post<{ message: string }>('/auth/change-password', payload),
  /** 邮箱密码登录（turnstileToken 为 Cloudflare 人机验证令牌，启用时必传） */
  login: (email: string, password: string, turnstileToken?: string) =>
    api.post<LoginResponse>('/auth/login', { email, password, cf_turnstile_token: turnstileToken }),
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
  /** 上架 / 下架商品（管理员）：在「已上架 / 已下架」分组间切换 */
  updateStatus: (id: string, isActive: boolean) =>
    api.post<{ id: string; name: string; is_active: boolean }>(`/items/${id}/status`, {
      is_active: isActive,
    }),
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
  /** 批量加分（教师/管理员）：判断公式 + Excel 判断值，服务端重算后单事务入账 */
  awardBatch: (payload: AwardBatchPayload) => api.post<AwardBatchResponse>('/students/award-batch', payload),
};

/** 系统配置项 */
export interface SystemSettingRecord {
  key: string;
  value: { enabled?: boolean } & Record<string, unknown>;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 当前用户资料（设置中心） */
export const userApi = {
  /** 获取当前用户资料 */
  me: () => api.get<Student>('/user'),
  /** 获取对普通用户可见的系统配置（只读） */
  getSystemSettings: () => api.get<SystemSettingRecord[]>('/user/system-settings'),
  /** 更新当前用户资料（昵称 / 学号） */
  update: (payload: UpdateProfilePayload) => api.put<Student>('/user', payload),
  /** 当前学生的兑换汇总（件数 / 消耗积分），用于分页场景下的准确统计 */
  summary: () => api.get<{ total_items: number; total_spent: number }>('/user/summary'),
  /** 注销账号（旧密码确认，不可逆） */
  deleteAccount: (password: string) => api.delete<{ message: string }>('/user', { old_password: password }),
};

/** 管理员设置（管理员） */
export const adminApi = {
  /** 系统配置管理 */
  systemSettings: {
    /** 获取所有系统配置 */
    list: () => api.get<SystemSettingRecord[]>('/admin/system-settings'),
    /** 更新系统配置 */
    update: (key: string, value: SystemSettingRecord['value']) =>
      api.post<SystemSettingRecord>('/admin/system-settings', { key, value }),
  },

  /** 区域管理：GET 对教职工开放（按授权范围裁剪），写操作仅超级管理员 */
  regions: {
    list: () => api.get<Region[]>('/admin/regions'),
    create: (payload: { name: string; type: Region['type']; parent_id?: string | null }) =>
      api.post<Region>('/admin/regions', payload),
    update: (id: string, payload: { name?: string; type?: Region['type']; parent_id?: string | null }) =>
      api.put<Region>(`/admin/regions/${id}`, payload),
    remove: (id: string) => api.delete<{ message: string }>(`/admin/regions/${id}`),
  },

  /** 区域授权（仅超级管理员） */
  members: {
    list: () => api.get<RegionMember[]>('/admin/members'),
    assign: (userId: string, regionId: string) =>
      api.post('/admin/members', { user_id: userId, region_id: regionId }),
    revoke: (userId: string, regionId: string) =>
      api.delete(`/admin/members?user_id=${userId}&region_id=${regionId}`),
  },

  /** 修改用户角色（仅超级管理员） */
  updateRole: (userId: string, role: UserRole) => api.put<Student>(`/admin/users/${userId}/role`, { role }),
};

/** 物品兑换 */
export const redemptionsApi = {
  /** 兑换商品（支持数量选择） */
  redeem: (itemId: string, quantity = 1) =>
    api.post<RedeemResponse>('/redemptions', { item_id: itemId, quantity }),
  /** 查询某学生的兑换记录（本人或教职工，分页） */
  listByStudent: (studentId: string, page: PageQuery = {}) =>
    api.get<Page<Redemption>>(`/redemptions/${studentId}${buildPageQuery(page)}`),
  /** 教职工：全部兑换记录（教师工作台发放队列，可按状态筛选） */
  listForStaff: (status?: FulfillmentStatus, page: PageQuery = {}) =>
    api.get<Page<StaffRedemption>>(`/redemptions${buildPageQuery({ ...page, status })}`),
  /** 教职工：更新发放状态（标记已发放 / 撤回为待发放） */
  updateStatus: (id: string, status: FulfillmentStatus) =>
    api.post<{ id: string; status: FulfillmentStatus }>(`/redemptions/${id}/status`, { status }),
};

/** 积分明细 */
export const ledgerApi = {
  /** 查询某学生的积分流水（分页） */
  listByStudent: (studentId: string, page: PageQuery = {}) =>
    api.get<Page<LedgerEntry>>(`/ledger/${studentId}${buildPageQuery(page)}`),
};

/** 管理员统计 */
export const statsApi = {
  get: () => api.get<Stats>('/stats'),
};

/** 学生积分排行榜 */
export const leaderboardApi = {
  /** 按积分倒序的前 50 名学生（仅 id/姓名/积分） */
  get: () => api.get<LeaderboardEntry[]>('/leaderboard'),
};
