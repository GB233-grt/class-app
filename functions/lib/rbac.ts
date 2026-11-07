/**
 * 区域权限（RBAC）工具
 *
 * 模型极简：
 *   角色 → super_admin 不限区域；admin/teacher 只能看被授权的区域及其子孙区域
 *   授权 → region_members(user_id, region_id)
 *
 * 说明：判定全部在服务端完成，前端只根据 /api/auth/me 返回的 region_scope 控制显隐。
 */
import { HttpError } from './http';
import { createAdminClient } from './supabase';
import type { Env, Student } from './types';

export type StaffRole = 'teacher' | 'admin' | 'super_admin';

/** 当前用户的区域范围 */
export interface RegionScope {
  /** 超级管理员：不受区域限制 */
  isSuperAdmin: boolean;
  /** null = 不限；数组 = 允许的区域 ID（已包含全部子孙区域）；空数组 = 无任何区域 */
  regionIds: string[] | null;
  /** 便于 O(1) 判断 */
  regionSet: Set<string> | null;
}

export const FULL_SCOPE: RegionScope = {
  isSuperAdmin: true,
  regionIds: null,
  regionSet: null,
};

/** 读取某用户的授权区域，并展开为「授权区域 + 全部子孙区域」 */
export async function loadRegionScope(env: Env, profile: Student): Promise<RegionScope> {
  if (profile.role === 'super_admin') return FULL_SCOPE;
  // 学生不需要区域范围
  if (profile.role === 'student') {
    return { isSuperAdmin: false, regionIds: [], regionSet: new Set() };
  }

  const admin = createAdminClient(env);
  const [{ data: regions, error: regionError }, { data: members, error: memberError }] =
    await Promise.all([
      admin.from('regions').select('id, parent_id'),
      admin.from('region_members').select('region_id').eq('user_id', profile.id),
    ]);

  if (regionError || memberError) {
    throw new HttpError(500, '读取区域授权失败，请确认已执行 15_regions_and_rbac.sql');
  }

  const childrenOf = new Map<string, string[]>();
  for (const row of (regions ?? []) as { id: string; parent_id: string | null }[]) {
    if (!row.parent_id) continue;
    const list = childrenOf.get(row.parent_id) ?? [];
    list.push(row.id);
    childrenOf.set(row.parent_id, list);
  }

  // BFS 展开子孙区域
  const allowed = new Set<string>();
  const queue = ((members ?? []) as { region_id: string }[]).map((m) => m.region_id);
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (allowed.has(id)) continue;
    allowed.add(id);
    for (const child of childrenOf.get(id) ?? []) {
      if (!allowed.has(child)) queue.push(child);
    }
  }

  return {
    isSuperAdmin: false,
    regionIds: [...allowed],
    regionSet: allowed,
  };
}

/** 该范围是否覆盖指定区域；regionId 为空时只有超管能访问 */
export function isRegionAllowed(scope: RegionScope, regionId: string | null | undefined): boolean {
  if (scope.isSuperAdmin) return true;
  if (!regionId) return false;
  return scope.regionSet?.has(regionId) ?? false;
}

/** 断言区域可访问，否则 403 */
export function assertRegionAllowed(scope: RegionScope, regionId: string | null | undefined): void {
  if (!isRegionAllowed(scope, regionId)) {
    throw new HttpError(403, '没有权限访问该区域的数据');
  }
}

/**
 * 断言目标学生可访问。
 * 学生按 region_id 判定；教师/管理员等账号若未分区，只有超管可见。
 */
export async function assertStudentAllowed(
  env: Env,
  scope: RegionScope,
  studentId: string,
): Promise<void> {
  if (scope.isSuperAdmin) return;
  const { data, error } = await createAdminClient(env)
    .from('students')
    .select('region_id')
    .eq('id', studentId)
    .maybeSingle();

  if (error) throw new HttpError(500, '校验学生区域失败');
  if (!data) throw new HttpError(404, '学生不存在');
  assertRegionAllowed(scope, (data as { region_id: string | null }).region_id);
}

/** 把区域范围翻译成 PostgREST 过滤条件；返回 null 表示不限制 */
export function regionFilter(scope: RegionScope): string[] | null {
  return scope.isSuperAdmin ? null : scope.regionIds ?? [];
}
