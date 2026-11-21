/**
 * 学生自愿开启的校园主题视频入口。
 * 视频目录仅在学生勾选开启后读取；iframe 仅在学生主动点击播放后挂载。
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { userApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Select } from '../../common/Select';
import { getErrorMessage } from '../../../lib/utils';
import type { EasterEggVideo } from '../../../types';

interface StudentEasterEggProps {
  studentId: string;
}

export function StudentEasterEgg({ studentId }: StudentEasterEggProps) {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [videoId, setVideoId] = useState('');
  const [videos, setVideos] = useState<EasterEggVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<EasterEggVideo | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 只读取本人可见的偏好字段；此接口不返回 hidden_tags 给学生。
  useEffect(() => {
    let cancelled = false;
    void userApi.myTags(studentId)
      .then((prefs) => {
        if (cancelled) return;
        setEnabled(prefs.easter_egg_opt_in);
        setVideoId(prefs.easter_egg_video_id ?? '');
      })
      .catch((err) => {
        if (!cancelled) showToast('error', getErrorMessage(err, '读取视频偏好失败'));
      })
      .finally(() => {
        if (!cancelled) setInitialized(true);
      });
    return () => { cancelled = true; };
  }, [showToast, studentId]);

  // opt-in 开启后才请求审核目录；不开启时不请求，也不挂载播放器。
  useEffect(() => {
    if (!initialized || !enabled) {
      setVideos([]);
      setPlaying(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void userApi.easterEggVideos()
      .then((result) => {
        if (cancelled) return;
        const safeVideos = result.enabled ? result.videos : [];
        setVideos(safeVideos);
        if (videoId && !safeVideos.some((video) => video.id === videoId)) setVideoId('');
      })
      .catch(() => { if (!cancelled) setVideos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, initialized, videoId]);

  const savePreference = async (nextEnabled = enabled, nextVideoId = videoId) => {
    setSaving(true);
    try {
      await userApi.updateMyTags(studentId, {
        easter_egg_opt_in: nextEnabled,
        easter_egg_video_id: nextEnabled ? nextVideoId || null : null,
      });
      showToast('success', nextEnabled ? '视频偏好已保存' : '已关闭校园视频彩蛋');
      if (!nextEnabled) {
        setEnabled(false);
        setVideoId('');
        setPlaying(null); // 卸载 iframe，停止播放
      }
    } catch (err) {
      showToast('error', getErrorMessage(err, '保存视频偏好失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleVideoChange = async (nextId: string) => {
    setVideoId(nextId);
    setPlaying(null);
    try {
      await userApi.updateMyTags(studentId, {
        easter_egg_opt_in: true,
        easter_egg_video_id: nextId || null,
      });
    } catch (err) {
      showToast('error', getErrorMessage(err, '保存视频选择失败'));
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-ink-200 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!initialized || saving}
          onChange={(event) => {
            const next = event.target.checked;
            setEnabled(next);
            setPlaying(null);
            void savePreference(next, next ? videoId : '');
          }}
          className="mt-1 h-4 w-4 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-semibold text-ink-800">自愿开启校园主题视频</span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-500">
            默认关闭。开启后可选看学校审核通过的视频；不会根据教师内部标签触发，不会自动播放。你可以随时关闭。
          </span>
        </span>
      </label>

      {enabled && (
        <div className="space-y-3 border-t border-ink-100 pt-3">
          {loading ? (
            <p className="text-sm text-ink-400">正在读取已审核视频…</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-ink-500">目前没有可选的已审核视频。</p>
          ) : (
            <>
              <Select label="选择校园主题视频" value={videoId} onChange={(event) => void handleVideoChange(event.target.value)}>
                <option value="">请选择</option>
                {videos.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
              </Select>
              {videoId && !playing && (
                <Button type="button" variant="outline" onClick={() => setPlaying(videos.find((v) => v.id === videoId) ?? null)}>
                  点击播放
                </Button>
              )}
              {playing && (
                <div className="space-y-2">
                  <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16 / 9' }}>
                    <iframe
                      title={playing.title}
                      src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(playing.bvid)}&autoplay=1&muted=1&danmaku=0&hideCoverInfo=1&noFullScreenButton=1`}
                      className="absolute inset-0 h-full w-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      referrerPolicy="no-referrer"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                    />
                  </div>
                  <button type="button" onClick={() => setPlaying(null)} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
                    <X className="h-4 w-4" />关闭视频
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <a href="/docs/usage-guide" className="inline-block text-xs font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">查看功能使用指南</a>
    </section>
  );
}
