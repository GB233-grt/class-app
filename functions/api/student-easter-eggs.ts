/**
 * 启幕视频彩蛋（自愿开启，仅学生端）
 *
 * 只有学生本人 opt-in 后才返回已审核的视频目录；不返回 hidden_tags，
 * 不根据教师内部标签决定视频，不在服务端自动分配任何内容。
 */
import { HttpError, jsonResponse } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { createAdminClient } from '../lib/supabase';
import type { Env } from '../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireAuth(env, request);
  if (ctx.profile.role !== 'student') throw new HttpError(403, '该功能仅对学生开放');

  const { data: prefs, error: prefsError } = await createAdminClient(env)
    .from('students')
    .select('easter_egg_opt_in, easter_egg_video_id')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (prefsError) throw new HttpError(500, '读取视频偏好失败');
  if (!prefs?.easter_egg_opt_in) return jsonResponse({ enabled: false, videos: [] });

  let query = createAdminClient(env)
    .from('easter_egg_videos')
    .select('id, title, bvid, description')
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(20);

  if (prefs.easter_egg_video_id) query = query.eq('id', prefs.easter_egg_video_id);
  const { data, error } = await query;
  if (error) throw new HttpError(500, '获取已审核校园视频失败');

  return jsonResponse({ enabled: true, videos: data ?? [] });
};
