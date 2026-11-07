/**
 * 认证与权限中间件
 * 从请求头解析 JWT → 校验用户 → 加载 students 表资料 → 角色校验 + 区域范围
 */
import { HttpError } from './http';
import { loadRegionScope, type RegionScope, FULL_SCOPE } from './rbac';
import { createUserClient } from './supabase';
import type { Env, Student } from './types';

/** 通过鉴权后的请求上下文 */
export interface AuthContext {
  /** 原始 JWT */
  token: string;
  /** Auth 用户 ID（与 students.id 一致） */
  userId: string;
  /** 学生/教师/管理员资料 */
  profile: Student;
  /** 超级管理员 */
  isSuperAdmin: boolean;
  /** 是否管理员（区域管理员或超级管理员） */
  isAdmin: boolean;
  /** 是否教师 */
  isTeacher: boolean;
  /** 是否教职工（教师 / 管理员 / 超级管理员） */
  isStaff: boolean;
  /** 区域范围：超管不限，其余按授权区域（含子孙） */
  regionScope: RegionScope;
}

/** 从请求头提取 Bearer Token */
function extractToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    throw new HttpError(401, '未登录或登录状态已失效');
  }
  return token;
}

/** 登录校验：任何已登录用户可通过 */
export async function requireAuth(env: Env, request: Request): Promise<AuthContext> {
  const token = extractToken(request);
  const client = createUserClient(env, token);

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new HttpError(401, '未登录或登录状态已失效');
  }

  const { data: profile, error: profileError } = await client
    .from('students')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(500, '获取用户资料失败');
  }
  if (!profile) {
    throw new HttpError(401, '用户资料不存在，请联系管理员在数据库中补录学生信息');
  }

  const typedProfile = profile as Student;
  const isSuperAdmin = typedProfile.role === 'super_admin';
  const isAdmin = typedProfile.role === 'admin' || isSuperAdmin;
  const isTeacher = typedProfile.role === 'teacher';
  const isStaff = isAdmin || isTeacher;

  return {
    token,
    userId: userData.user.id,
    profile: typedProfile,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    isStaff,
    regionScope: isStaff ? await loadRegionScope(env, typedProfile, token) : FULL_SCOPE,
  };
}

/** 管理员校验：区域管理员或超级管理员可通过 */
export async function requireAdmin(env: Env, request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(env, request);
  if (!ctx.isAdmin) {
    throw new HttpError(403, '没有权限执行该操作');
  }
  return ctx;
}

/** 超级管理员校验：用户 / 角色 / 区域 / 权限配置专用 */
export async function requireSuperAdmin(env: Env, request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(env, request);
  if (!ctx.isSuperAdmin) {
    throw new HttpError(403, '只有超级管理员可以执行该操作');
  }
  return ctx;
}

/** 教职工校验：教师或管理员可通过（查看兑换记录、发放确认、积分调整） */
export async function requireStaff(env: Env, request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(env, request);
  if (!ctx.isStaff) {
    throw new HttpError(403, '没有权限执行该操作');
  }
  return ctx;
}
