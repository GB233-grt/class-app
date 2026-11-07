/**
 * /api/students
 *   GET  —— 获取用户列表（教师/管理员：教师需要名单以便加分）
 *   POST —— 创建用户（管理员）：先在 Supabase Auth 创建登录账号，再写入 students 表
 *           支持角色选择：学生（默认）或教师
 */
import { HttpError, jsonResponse, optionalString, readJson, requireInt, requireString, translateDbError } from '../../lib/http';
import { requireAdmin, requireStaff } from '../../lib/auth';
import { assertRegionAllowed } from '../../lib/rbac';
import { createAdminClient, createUserClient } from '../../lib/supabase';
import type { Env, Student } from '../../lib/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 教职工：获取用户列表（教师工作台加分时需要学生名单）
// 区域隔离：非超管只能看到自己授权区域（含子孙）内的账号
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);

  let query = createUserClient(env, ctx.token)
    .from('students')
    .select('*')
    .order('created_at', { ascending: true });

  if (!ctx.regionScope.isSuperAdmin) {
    const allowed = ctx.regionScope.regionIds ?? [];
    // 没有任何授权区域：直接返回空列表，避免误查全量
    if (allowed.length === 0) return jsonResponse([] as Student[]);
    query = query.in('region_id', allowed);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, '获取学生列表失败');
  }
  return jsonResponse((data ?? []) as Student[]);
};

// 管理员创建学生（含登录账号）
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAdmin(env, request);

  const body = await readJson<Record<string, unknown>>(request);
  const name = requireString(body.name, '学生姓名', { max: 20 });
  const studentNo = optionalString(body.student_no, 20);
  const email = requireString(body.email, '邮箱', { max: 100 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, '邮箱格式不正确');
  }
  const password = requireString(body.password, '初始密码', { max: 32 });
  if (password.length < 6) {
    throw new HttpError(400, '初始密码至少 6 位');
  }
  // 角色：学生（默认）或教师；教师无积分概念，初始积分强制为 0
  const role: 'student' | 'teacher' = body.role === 'teacher' ? 'teacher' : 'student';
  const points =
    role === 'teacher' ? 0 : requireInt(body.points ?? 0, '初始积分', { min: 0, max: 1000000 });

  // 区域：必须落在自己的授权范围内；只授权了一个区域时可省略
  const rawRegionId = optionalString(body.region_id, 40);
  let regionId = rawRegionId;
  if (!regionId) {
    const allowed = ctx.regionScope.regionIds ?? [];
    if (ctx.regionScope.isSuperAdmin) {
      throw new HttpError(400, '请选择所属区域');
    }
    if (allowed.length !== 1) {
      throw new HttpError(400, '请选择所属区域');
    }
    regionId = allowed[0];
  }
  assertRegionAllowed(ctx.regionScope, regionId);

  const adminClient = createAdminClient(env);

  // 第一步：在 Supabase Auth 中创建登录账号（免邮箱验证，由管理员线下交付密码）
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError || !authData.user) {
    const message = authError?.message ?? '';
    if (message.includes('already been registered') || message.includes('already exists')) {
      throw new HttpError(409, '该邮箱已被注册');
    }
    throw new HttpError(500, `创建登录账号失败：${message || '未知错误'}`);
  }

  // 第二步：写入学生业务表（ID 与 Auth 用户保持一致，RLS 依赖该对应关系）
  const { data: profile, error: insertError } = await adminClient
    .from('students')
    .insert({ id: authData.user.id, name, student_no: studentNo, email, role, points, region_id: regionId })
    .select('*')
    .single();

  if (insertError) {
    // 回滚：删除刚创建的 Auth 账号，保持两侧数据一致
    await adminClient.auth.admin.deleteUser(authData.user.id);
    throw new HttpError(500, `创建学生资料失败：${translateDbError(insertError.message)}`);
  }

  // 第三步：初始积分大于 0 时，写入积分明细（初始积分）
  if (points > 0) {
    await adminClient.from('points_ledger').insert({
      student_id: authData.user.id,
      delta: points,
      balance_after: points,
      reason: '初始积分',
      actor_id: null,
    });
  }

  return jsonResponse(profile, 201);
};
