/**
 * 启幕宣传页管理（教师 / 管理员）
 *
 * 教师：创建草稿、提交审核、修改被驳回的内容
 * 管理员：审核通过 / 驳回、上线 / 下线、删除
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Megaphone, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { promoApi } from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { Textarea } from '../../common/Textarea';
import { cn, formatDateTime, getErrorMessage } from '../../../lib/utils';
import type { PromoPage, PromoStatus } from '../../../types';

const STATUS_META: Record<PromoStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-ink-100 text-ink-600' },
  pending: { label: '待审核', className: 'bg-amber-50 text-amber-700' },
  published: { label: '已发布', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-600' },
  offline: { label: '已下线', className: 'bg-ink-200 text-ink-700' },
};

const FREQUENCY_LABEL: Record<string, string> = {
  once_per_launch: '每次启动',
  daily: '每日一次',
  once_per_content: '仅展示一次',
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: '所有人',
  student: '仅学生',
  staff: '仅教职工',
};

const EMPTY_FORM = {
  title: '',
  body: '',
  image_url: '',
  link_url: '',
  link_label: '',
  frequency: 'daily',
  audience: 'all',
  start_at: '',
  end_at: '',
  sort_order: '0',
};

/** ISO ↔ datetime-local */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function PromoPagesPanel() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [items, setItems] = useState<PromoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await promoApi.list({ limit: 50 });
      setItems(page.items);
    } catch (err) {
      showToast('error', getErrorMessage(err, '读取宣传内容失败，请确认已执行 18_promo_pages.sql'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (page: PromoPage) => {
    setEditingId(page.id);
    setShowForm(true);
    setForm({
      title: page.title,
      body: page.body,
      image_url: page.image_url ?? '',
      link_url: page.link_url ?? '',
      link_label: page.link_label ?? '',
      frequency: page.frequency,
      audience: page.audience,
      start_at: toLocalInput(page.start_at),
      end_at: toLocalInput(page.end_at),
      sort_order: String(page.sort_order),
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('error', '标题与正文不能为空');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        image_url: form.image_url.trim() || null,
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        frequency: form.frequency,
        audience: form.audience,
        start_at: fromLocalInput(form.start_at),
        end_at: fromLocalInput(form.end_at),
        sort_order: Number(form.sort_order) || 0,
      } as Partial<PromoPage>;

      if (editingId) {
        await promoApi.update(editingId, payload);
        showToast('success', '内容已更新');
      } else {
        await promoApi.create(payload);
        showToast('success', '草稿已创建，可提交审核');
      }
      resetForm();
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '保存失败'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (page: PromoPage, action: 'submit' | 'approve' | 'reject' | 'publish' | 'offline') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('请填写驳回理由（会展示给提交人）');
      if (input === null) return;
      if (!input.trim()) {
        showToast('error', '驳回必须填写理由');
        return;
      }
      reason = input.trim();
    }
    setBusy(true);
    try {
      await promoApi.act(page.id, action, reason);
      showToast('success', '操作成功');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '操作失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (page: PromoPage) => {
    if (!window.confirm(`确认删除「${page.title}」？`)) return;
    setBusy(true);
    try {
      await promoApi.remove(page.id);
      showToast('success', '已删除');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '删除失败'));
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at)),
    [items],
  );

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-10 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> 正在读取宣传内容…
      </Card>
    );
  }

  return (
    <div className="animate-fade-up space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
              <Megaphone className="h-5 w-5 text-brand-600" />
              启幕宣传页
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              用户启动应用时展示的正能量宣传内容。教师提交后需管理员审核通过才会对外展示。
            </p>
          </div>
          <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            <Plus className="h-4 w-4" />
            {showForm ? '收起表单' : '新建内容'}
          </Button>
        </div>

        {showForm && (
          <div className="mt-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="标题（≤40 字）"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="例如：学习红岩精神，做新时代青年"
              />
              <Input
                label="配图地址（选填，https）"
                value={form.image_url}
                onChange={(e) => setField('image_url', e.target.value)}
                placeholder="https://…/hongyan.webp"
              />
            </div>
            <Textarea
              label="正文（≤300 字）"
              rows={3}
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
              placeholder="用一两句话说明这次宣传的主题与意义"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="跳转链接（选填，需教育/政务域名）"
                value={form.link_url}
                onChange={(e) => setField('link_url', e.target.value)}
                placeholder="https://www.example.edu.cn/special/hongyan"
              />
              <Input
                label="按钮文案（选填，≤12 字）"
                value={form.link_label}
                onChange={(e) => setField('link_label', e.target.value)}
                placeholder="查看详情"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="展示频次"
                value={form.frequency}
                onChange={(e) => setField('frequency', e.target.value)}
              >
                <option value="daily">每日一次</option>
                <option value="once_per_launch">每次启动</option>
                <option value="once_per_content">仅展示一次</option>
              </Select>
              <Select
                label="受众"
                value={form.audience}
                onChange={(e) => setField('audience', e.target.value)}
              >
                <option value="all">所有人</option>
                <option value="student">仅学生</option>
                <option value="staff">仅教职工</option>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="生效开始（选填）"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setField('start_at', e.target.value)}
              />
              <Input
                label="生效结束（选填）"
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setField('end_at', e.target.value)}
              />
              <Input
                label="排序（越小越靠前）"
                type="number"
                value={form.sort_order}
                onChange={(e) => setField('sort_order', e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm} disabled={busy}>
                取消
              </Button>
              <Button onClick={() => void handleSubmit()} loading={busy}>
                {editingId ? '保存修改' : '创建草稿'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {sorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-400">还没有宣传内容，点击「新建内容」开始</Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((page) => {
            const meta = STATUS_META[page.status];
            const canEdit = ['draft', 'rejected'].includes(page.status);
            return (
              <Card key={page.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', meta.className)}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-ink-400">
                        {FREQUENCY_LABEL[page.frequency]} · {AUDIENCE_LABEL[page.audience]} · 排序{' '}
                        {page.sort_order}
                      </span>
                    </div>
                    <h3 className="mt-1 font-medium text-ink-900">{page.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{page.body}</p>
                    {page.reject_reason && (
                      <p className="mt-1 text-xs text-red-600">驳回理由：{page.reject_reason}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-400">
                      {page.start_at ? `生效：${formatDateTime(page.start_at)}` : '生效：立即'}
                      {page.end_at ? ` ~ ${formatDateTime(page.end_at)}` : ' ~ 长期'}
                      {' · '}曝光 {page.view_count} / 点击 {page.click_count}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(page)} disabled={busy}>
                        编辑
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => void act(page, 'submit')} disabled={busy}>
                        <Send className="h-3.5 w-3.5" />
                        提交审核
                      </Button>
                    )}
                    {isAdmin && page.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => void act(page, 'approve')} disabled={busy}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          通过并发布
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void act(page, 'reject')}
                          disabled={busy}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          驳回
                        </Button>
                      </>
                    )}
                    {isAdmin && page.status === 'published' && (
                      <Button size="sm" variant="outline" onClick={() => void act(page, 'offline')} disabled={busy}>
                        下线
                      </Button>
                    )}
                    {isAdmin && page.status === 'offline' && (
                      <Button size="sm" variant="outline" onClick={() => void act(page, 'publish')} disabled={busy}>
                        <Clock className="h-3.5 w-3.5" />
                        重新上线
                      </Button>
                    )}
                    {isAdmin && page.status !== 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDelete(page)}
                        disabled={busy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
