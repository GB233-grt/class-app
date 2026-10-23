/**
 * 认证与权限中间件
 * 从请求头解析 JWT → 校验用户 → 加载 students 表资料 → 角色校验
 */
import { HttpError } from './http';
import { createUserClient } from './supabase';
import type { Env, Student } from './types';

/** 通过鉴权后的请求上下文 */
export interface AuthContext {
  /** 原始 JWT */
  token: string;
  /** Auth 用户 ID（与 students.id 一致） */
  userId: string;
  /** 学生/管理员资料 */
  profile: Student;
  /** 是否管理员 */
  isAdmin: boolean;
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

/** 登录校验：任何已登录用户（学生或管理员）可通过 */
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
  return {
    token,
    userId: userData.user.id,
    profile: typedProfile,
    isAdmin: typedProfile.role === 'admin',
  };
}

/** 管理员校验：仅管理员角色可通过 */
export async function requireAdmin(env: Env, request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(env, request);
  if (!ctx.isAdmin) {
    throw new HttpError(403, '没有权限执行该操作');
  }
  return ctx;
}
