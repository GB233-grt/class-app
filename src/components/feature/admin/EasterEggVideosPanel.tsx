/**
 * 校园主题视频管理：教师提交待审核，管理员审核与上下线。
 * 区域范围和角色权限由后端接口强制校验。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CircleHelp, Eye, EyeOff, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { adminApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { Textarea } from '../../common/Textarea';
import { cn, getErrorMessage } from '../../../lib/utils';
import type { EasterEggVideo, Region } from '../../../types';

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已审核' },
  { value: 'rejected', label: '已驳回' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已审核',
  rejected: '已驳回',
};

const CATEGORY_LABEL: Record<string, string> = {
  campus: '校园',
  study: '学习',
  culture: '文化',
  other: '其他',
};

export function EasterEggVideosPanel() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [videos, setVideos] = useState<EasterEggVideo[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [bvid, setBvid] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'campus' | 'study' | 'culture' | 'other'>('campus');
  const [regionId, setRegionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [videoRows, regionRows] = await Promise.all([
        adminApi.easterEggVideos.list(filter === 'all' ? undefined : filter),
        adminApi.regions.list(),
      ]);
      setVideos(videoRows);
      setRegions(regionRows);
    } catch (err) {
      showToast('error', getErrorMessage(err, '获取校园视频失败；检查 20/21 号迁移和区域授权'));
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => { void load(); }, [load]);

  const regionLabel = useMemo(() => new Map(regions.map((region) => [region.id, region.name])), [regions]);

  const submit = async () => {
    const normalizedBvid = bvid.trim();
    if (!title.trim() || !/^BV[0-9A-Za-z]{10}$/.test(normalizedBvid)) {
      showToast('error', '请填写标题，并确认 BV 号格式正确（BV + 10 位字母数字）');
      return;
    }
    setFormBusy(true);
    try {
      await adminApi.easterEggVideos.submit({
        title: title.trim(),
        bvid: normalizedBvid,
        description: description.trim(),
        category,
        region_id: regionId || undefined,
      });
      showToast('success', '已提交审核；通过前不会向学生显示');
      setTitle(''); setBvid(''); setDescription(''); setRegionId(''); setFormOpen(false);
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '提交视频失败'));
    } finally {
      setFormBusy(false);
    }
  };

  const act = async (video: EasterEggVideo, action: 'approve' | 'reject' | 'enable' | 'disable') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('请填写驳回理由');
      if (input === null) return;
      if (!input.trim()) { showToast('error', '驳回理由不能为空'); return; }
      reason = input.trim();
    }
    setBusyId(video.id);
    try {
      await adminApi.easterEggVideos.action(video.id, action, reason);
      showToast('success', '操作成功');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '操作失败'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-up space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
              <ShieldCheck className="h-5 w-5 text-brand-600" /> 校园主题视频审核
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              仅审核通过且启用的视频会进入学生自愿选择目录。学生 opt-in 默认关闭，视频不自动播放；内部标签与视频推荐无关。
            </p>
            <a href="/docs/usage-guide" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
              <CircleHelp className="h-3.5 w-3.5" />查看功能使用指南
            </a>
          </div>
          <Button onClick={() => setFormOpen((open) => !open)}>
            <Plus className="h-4 w-4" />{formOpen ? '收起' : '提交视频'}
          </Button>
        </div>

        {formOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="视频标题" value={title} maxLength={80} placeholder="校园主题视频标题" onChange={(e) => setTitle(e.target.value)} />
              <Input label="B 站 BV 号" value={bvid} maxLength={12} placeholder="BV1xxxxxxxxx" onChange={(e) => setBvid(e.target.value.trim())} />
            </div>
            <Textarea label="简介" value={description} maxLength={300} rows={2} placeholder="说明视频主题及适合的年级" onChange={(e) => setDescription(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="分类" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="campus">校园</option><option value="study">学习</option><option value="culture">文化</option><option value="other">其他</option>
              </Select>
              <Select label="所属区域" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                <option value="">全校（仅超级管理员可提交）</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </Select>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              提交即进入待审核；标题、简介和 BV 号会被审核。请确保内容适合校园观看，不含广告、羞辱或不当内容。
            </p>
            <div className="flex justify-end">
              <Button loading={formBusy} onClick={() => void submit()}>提交审核</Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="视频审核状态筛选">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              filter === item.value ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >{item.label}</button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-ink-500"><Loader2 className="h-4 w-4 animate-spin" />加载中…</Card>
      ) : videos.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-400">当前筛选下没有视频</Card>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <Card key={video.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{video.title}</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', video.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : video.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700')}>
                    {STATUS_LABEL[video.status ?? 'pending']}
                  </span>
                  {video.status === 'approved' && <span className={cn('rounded-full px-2 py-0.5 text-xs', video.is_active ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500')}>{video.is_active ? '已启用' : '已停用'}</span>}
                </div>
                <p className="mt-1 text-sm text-ink-500">BV 号：{video.bvid} · {CATEGORY_LABEL[video.category ?? 'other']} · 区域：{video.region_id ? (regionLabel.get(video.region_id) ?? '未知区域') : '全校'}</p>
                {video.description && <p className="mt-1 text-sm text-ink-600">{video.description}</p>}
                {video.reject_reason && <p className="mt-1 text-xs text-red-600">驳回理由：{video.reject_reason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && video.status === 'pending' && <>
                  <Button size="sm" onClick={() => void act(video, 'approve')} disabled={busyId === video.id}><Check className="h-4 w-4"/>审核通过</Button>
                  <Button size="sm" variant="outline" onClick={() => void act(video, 'reject')} disabled={busyId === video.id}><X className="h-4 w-4"/>驳回</Button>
                </>}
                {isAdmin && video.status === 'approved' && (video.is_active ?
                  <Button size="sm" variant="outline" onClick={() => void act(video, 'disable')} disabled={busyId === video.id}><EyeOff className="h-4 w-4"/>停用</Button> :
                  <Button size="sm" variant="outline" onClick={() => void act(video, 'enable')} disabled={busyId === video.id}><Eye className="h-4 w-4"/>启用</Button>)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
