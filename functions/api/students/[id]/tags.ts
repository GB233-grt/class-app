/**
 * 学生标签管理 + 自愿视频彩蛋偏好
 *
 * GET/PUT /api/students/:id/tags
 *   教师及以上可管理被授权区域学生标签；学生只能读取/修改自己的公开标签与自愿偏好。
 *   hidden_tags 只有教职工响应会包含，学生响应不含此字段。
 *
 * GET /api/student-easter-eggs
 *   返回学生本人 opt-in 后已审核可播放的视频候选；绝不返回其 hidden_tags。
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../../lib/http';
import { requireAuth } from '../../../lib/auth';
import { assertStudentAllowed } from '../../../lib/rbac';
import { createAdminClient } from '../../../lib/supabase';
import type { Env } from '../../../lib/types';

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 20;

function parseTags(raw: unknown, field: string): string[] {
  if (!Array.isArray(raw)) throw new HttpError(400, `${field}必须是字符串数组`);
  if (raw.length > MAX_TAGS) throw new HttpError(400, `${field}最多 ${MAX_TAGS} 个`);
  const tags = raw.map((item) => requireString(item, field, { max: MAX_TAG_LENGTH }));
  return [...new Set(tags)];
}

/** 管理员/教师：管理目标学生的标签。学生本人：只可管理 public_tags 和自愿偏好。 */
export const onRequestGet: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireAuth(env, request);
  const id = String(params.id);
  const isSelf = ctx.userId === id;
  const isStaff = ctx.isStaff;

  if (!isSelf && !isStaff) throw new HttpError(403, '只能查看自己的公开标签');
  if (isStaff && !isSelf) await assertStudentAllowed(env, ctx.regionScope, id);

  const { data, error } = await createAdminClient(env)
    .from('students')
    .select('id, public_tags, easter_egg_opt_in, easter_egg_video_id, hidden_tags')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new HttpError(500, '读取标签失败');
  if (!data) throw new HttpError(404, '用户不存在');

  const row = data as {
    id: string;
    public_tags: string[] | null;
    hidden_tags: string[] | null;
    easter_egg_opt_in: boolean | null;
    easter_egg_video_id: string | null;
  };
  const response: Record<string, unknown> = {
    id: row.id,
    public_tags: row.public_tags ?? [],
    easter_egg_opt_in: row.easter_egg_opt_in ?? false,
    easter_egg_video_id: row.easter_egg_video_id,
  };
  // 关键安全边界：仅教职工拿到隐形标签；本人学生请求永不下发 hidden_tags。
  if (isStaff) response.hidden_tags = row.hidden_tags ?? [];
  return jsonResponse(response);
};

export const onRequestPut: PagesFunction<Env, 'id'> = async ({ params, request, env }) => {
  const ctx = await requireAuth(env, request);
  const id = String(params.id);
  const isSelf = ctx.userId === id;
  const body = await readJson<Record<string, unknown>>(request);
  const update: Record<string, unknown> = {};

  if (isSelf && !ctx.isStaff) {
    // 学生只能写自己的公开标签及自愿视频偏好，绝不可写 hidden_tags。
    if ('hidden_tags' in body) throw new HttpError(403, '学生不能设置内部管理标签');
    if (body.public_tags !== undefined) update.public_tags = parseTags(body.public_tags, '公开标签');
    if (body.easter_egg_opt_in !== undefined) {
      if (typeof body.easter_egg_opt_in !== 'boolean') {
        throw new HttpError(400, '校园视频彩蛋设置必须为布尔值');
      }
      update.easter_egg_opt_in = body.easter_egg_opt_in;
      // 用户关闭自愿彩蛋时同时清掉之前选择的视频
      if (!body.easter_egg_opt_in) update.easter_egg_video_id = null;
    }
    if (body.easter_egg_video_id !== undefined) {
      if (body.easter_egg_video_id !== null && typeof body.easter_egg_video_id !== 'string') {
        throw new HttpError(400, '视频选择无效');
      }
      update.easter_egg_video_id = body.easter_egg_video_id;
    }
  } else if (ctx.isStaff) {
    // 教师/管理员必须只在授权范围内编辑学生标签。
    await assertStudentAllowed(env, ctx.regionScope, id);
    if (body.public_tags !== undefined) update.public_tags = parseTags(body.public_tags, '公开标签');
    if (body.hidden_tags !== undefined) update.hidden_tags = parseTags(body.hidden_tags, '隐形标签');
    // 教师不代替学生开启自愿视频；仅超管可在紧急情况下调整（当前 UI 不暴露此字段）。
    if (body.easter_egg_opt_in !== undefined || body.easter_egg_video_id !== undefined) {
      if (!ctx.isSuperAdmin) throw new HttpError(403, '视频彩蛋必须由学生本人自愿设置');
      if (body.easter_egg_opt_in !== undefined && typeof body.easter_egg_opt_in !== 'boolean') {
        throw new HttpError(400, '校园视频彩蛋设置必须为布尔值');
      }
      if (body.easter_egg_opt_in !== undefined) update.easter_egg_opt_in = body.easter_egg_opt_in;
      if (body.easter_egg_video_id !== undefined) update.easter_egg_video_id = body.easter_egg_video_id;
    }
  } else {
    throw new HttpError(403, '没有权限修改该用户标签');
  }

  if (Object.keys(update).length === 0) throw new HttpError(400, '没有需要更新的标签');

  // 仅审核通过的视频可由学生选择。视频来源是管理员维护的安全目录，不信任客户端 BV 号。
  if (update.easter_egg_video_id) {
    const { data: video } = await createAdminClient(env)
      .from('easter_egg_videos')
      .select('id')
      .eq('id', update.easter_egg_video_id)
      .eq('status', 'approved')
      .maybeSingle();
    if (!video) throw new HttpError(400, '该视频不存在或尚未审核通过');
  }

  const { data, error } = await createAdminClient(env)
    .from('students')
    .update(update)
    .eq('id', id)
    .select('id, public_tags, easter_egg_opt_in, easter_egg_video_id')
    .maybeSingle();
  if (error) throw new HttpError(500, translateDbError(error.message));
  if (!data) throw new HttpError(404, '用户不存在');
  return jsonResponse(data);
};
