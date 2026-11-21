/**
 * 学生管理面板：学生列表（表格）+ 积分增减操作
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShieldAlert, Tag, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus, Users } from 'lucide-react';
import { adminApi, studentsApi } from '../../../api';
import { useStudents } from '../../../hooks/useStudents';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Input } from '../../common/Input';
import { ErrorNotice } from '../../common/States';
import { cn, formatPoints, getErrorMessage } from '../../../lib/utils';
import { POINT_REASONS } from '../../../lib/constants';
import { awardFormSchema, type AwardFormValues } from '../../../lib/validation';
import type { Student } from '../../../types';

export function StudentsPanel() {
  const { students, loading, error, refresh } = useStudents();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Student | null>(null);
  const [tagTarget, setTagTarget] = useState<Student | null>(null);
  const [publicTags, setPublicTags] = useState<string[]>([]);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [publicTagInput, setPublicTagInput] = useState('');
  const [hiddenTagInput, setHiddenTagInput] = useState('');
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [tagConfirm, setTagConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AwardFormValues>({
    resolver: zodResolver(awardFormSchema),
    defaultValues: { type: 'add', amount: '', reason: '' },
  });

  const adjustType = watch('type');

  const openTags = async (student: Student) => {
    setTagTarget(student);
    setTagsLoading(true);
    setTagConfirm(false);
    try {
      const data = await adminApi.studentTags(student.id);
      setPublicTags(data.public_tags ?? []);
      setHiddenTags(data.hidden_tags ?? []);
      setPublicTagInput('');
      setHiddenTagInput('');
    } catch (err) {
      showToast('error', getErrorMessage(err, '读取标签失败'));
      setTagTarget(null);
    } finally {
      setTagsLoading(false);
    }
  };

  const addTag = (kind: 'public' | 'hidden') => {
    const tag = (kind === 'public' ? publicTagInput : hiddenTagInput).trim();
    if (!tag) return;
    if (tag.length > 20) {
      showToast('error', '标签最多 20 个字符');
      return;
    }
    const current = kind === 'public' ? publicTags : hiddenTags;
    if (current.length >= 8) {
      showToast('error', '每类标签最多 8 个');
      return;
    }
    if (current.includes(tag)) {
      showToast('error', '标签已存在');
      return;
    }
    if (kind === 'public') setPublicTags((prev) => [...prev, tag]);
    else setHiddenTags((prev) => [...prev, tag]);
    if (kind === 'public') setPublicTagInput('');
    else setHiddenTagInput('');
  };

  const saveTags = async () => {
    if (!tagTarget) return;
    setTagsSaving(true);
    try {
      await adminApi.updateStudentTags(tagTarget.id, { public_tags: publicTags, hidden_tags: hiddenTags });
      showToast('success', '标签已保存');
      setTagConfirm(false);
      await refresh();
      setTagTarget(null);
    } catch (err) {
      showToast('error', getErrorMessage(err, '保存标签失败'));
    } finally {
      setTagsSaving(false);
    }
  };

  const columns: DataTableColumn<Student>[] = [
    {
      header: '姓名',
      render: (student) => <span className="font-medium text-ink-900">{student.name}</span>,
    },
    {
      header: '学号',
      render: (student) => <span className="text-ink-500">{student.student_no ?? '—'}</span>,
    },
    {
      header: '角色',
      render: (student) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            student.role === 'super_admin' && 'bg-violet-600 text-white',
            student.role === 'admin' && 'bg-ink-950 text-white',
            student.role === 'teacher' && 'bg-amber-50 text-amber-700',
            student.role === 'student' && 'bg-brand-50 text-brand-700',
          )}
        >
          {student.role === 'super_admin'
            ? '超级管理员'
            : student.role === 'admin'
              ? '管理员'
              : student.role === 'teacher'
                ? '教师'
                : '学生'}
        </span>
      ),
    },
    {
      header: '当前积分',
      render: (student) => (
        <span className="font-semibold text-ink-900">{formatPoints(student.points)}</span>
      ),
    },
    {
      header: '操作',
      render: (student) =>
        student.role === 'student' ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={selected?.id === student.id ? 'dark' : 'outline'}
              onClick={() => {
                setSelected(student);
                reset({ type: 'add', amount: '', reason: '' });
              }}
            >
              {selected?.id === student.id ? '操作中' : '调整积分'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void openTags(student)}>
              <Tag className="h-3.5 w-3.5" />
              标签
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
    },
  ];

  // 提交积分调整（正数增加、负数扣减，后端原子校验余额）
  const onSubmit = handleSubmit(async (values) => {
    if (!selected) return;
    const amount = Number(values.amount);
    const delta = values.type === 'add' ? amount : -amount;
    try {
      const result = await studentsApi.award({
        student_id: selected.id,
        delta,
        reason: values.reason,
      });
      showToast(
        'success',
        `已${values.type === 'add' ? '增加' : '扣减'} ${formatPoints(amount)} 积分，当前余额 ${formatPoints(result.balance_after)}`,
      );
      reset({ type: values.type, amount: '', reason: '' });
      await refresh();
      setSelected((prev) => (prev ? { ...prev, points: result.balance_after } : prev));
    } catch (err) {
      showToast('error', getErrorMessage(err, '积分调整失败'));
    }
  });

  return (
    <div className="animate-fade-up space-y-4">
      <h2 className="font-display text-lg font-bold text-ink-900">学生列表</h2>

      {error ? (
        <ErrorNotice message={error} onRetry={() => void refresh()} />
      ) : (
        <DataTable
          columns={columns}
          rows={students}
          rowKey={(student) => student.id}
          loading={loading}
          emptyText={'暂无学生，请前往「新建学生」标签页创建'}
          emptyIcon={Users}
        />
      )}

      {/* 积分操作面板 */}
      {selected && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-ink-900">积分操作</h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-ink-400 transition-colors hover:text-ink-600"
            >
              关闭
            </button>
          </div>
          <p className="mb-4 text-sm text-ink-500">
            正在对 <span className="font-medium text-ink-900">{selected.name}</span>
            （当前 {formatPoints(selected.points)} 积分）进行积分调整
          </p>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {/* 调整类型 */}
            <div className="grid grid-cols-2 gap-2">
              <label
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                  adjustType === 'add'
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300',
                )}
              >
                <input type="radio" value="add" className="sr-only" {...register('type')} />
                <Plus className="h-4 w-4" />
                增加积分
              </label>
              <label
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                  adjustType === 'deduct'
                    ? 'border-red-400 bg-red-50 text-red-600'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300',
                )}
              >
                <input type="radio" value="deduct" className="sr-only" {...register('type')} />
                <Minus className="h-4 w-4" />
                扣减积分
              </label>
            </div>
            {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="积分数量"
                type="number"
                min={1}
                placeholder="例如：20"
                error={errors.amount?.message}
                {...register('amount')}
              />
              <div>
                <Input
                  label="变动原因"
                  list="point-reasons"
                  placeholder="选择或填写原因"
                  error={errors.reason?.message}
                  {...register('reason')}
                />
                {/* 可扩展的原因联想列表（见 src/lib/constants.ts） */}
                <datalist id="point-reasons">
                  {POINT_REASONS.map((reason) => (
                    <option key={reason} value={reason} />
                  ))}
                </datalist>
              </div>
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              variant={adjustType === 'add' ? 'primary' : 'danger'}
              className="w-full sm:w-auto"
            >
              确认{adjustType === 'add' ? '增加' : '扣减'}
            </Button>
          </form>
        </Card>
      )}
      {/* 标签管理抽屉 */}
      {tagTarget && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink-950/40"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTagTarget(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-tags-title"
            className="animate-fade-up h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="student-tags-title" className="text-xl font-bold text-ink-950">
                  {tagTarget.name} · 标签管理
                </h3>
                <p className="mt-1 text-sm text-ink-500">学号：{tagTarget.student_no || '未填写'}</p>
              </div>
              <button
                type="button"
                aria-label="关闭标签管理"
                onClick={() => setTagTarget(null)}
                className="rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
              ><X className="h-4 w-4" /></button>
            </div>

            {tagsLoading ? (
              <p className="mt-8 text-sm text-ink-400">正在加载标签…</p>
            ) : (
              <div className="mt-6 space-y-6">
                <section className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-ink-900">公开标签</h4>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">
                      标签会显示在学生个人资料中。请使用积极、尊重且适合校园公开展示的描述。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {publicTags.length === 0 && <span className="text-sm text-ink-400">暂无公开标签</span>}
                    {publicTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-700">
                        {tag}
                        <button type="button" aria-label={`移除公开标签 ${tag}`} onClick={() => setPublicTags((tags) => tags.filter((x) => x !== tag))} className="text-brand-500 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Input label="添加公开标签" value={publicTagInput} maxLength={20} placeholder="如：阅读爱好者" onChange={(e) => setPublicTagInput(e.target.value)} />
                    </div>
                    <Button type="button" variant="outline" onClick={() => addTag('public')} disabled={!publicTagInput.trim() || publicTags.length >= 8}>添加</Button>
                  </div>
                </section>

                <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <div>
                    <h4 className="font-semibold text-ink-900">隐形标签（仅校方内部）</h4>
                    <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      仅供获授权教师和管理员内部管理使用，不对学生展示，也不会用于触发视频或其他学生端效果。请勿添加羞辱、歧视或敏感个人信息。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hiddenTags.length === 0 && <span className="text-sm text-ink-400">暂无内部标签</span>}
                    {hiddenTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-900">
                        {tag}
                        <button type="button" aria-label={`移除隐形标签 ${tag}`} onClick={() => setHiddenTags((tags) => tags.filter((x) => x !== tag))} className="text-amber-700 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['大帝', '卷王', '摸鱼王'].map((tag) => (
                      <button key={tag} type="button" disabled={hiddenTags.includes(tag) || hiddenTags.length >= 8} onClick={() => setHiddenTags((tags) => [...tags, tag])} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40">+ {tag}</button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Input label="自定义内部标签" value={hiddenTagInput} maxLength={20} placeholder="仅教师/管理员可见" onChange={(e) => setHiddenTagInput(e.target.value)} />
                    </div>
                    <Button type="button" variant="outline" onClick={() => addTag('hidden')} disabled={!hiddenTagInput.trim() || hiddenTags.length >= 8}>添加</Button>
                  </div>
                </section>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-100 bg-white py-4">
                  <Button type="button" variant="ghost" onClick={() => setTagTarget(null)}>取消</Button>
                  <Button type="button" onClick={() => setTagConfirm(true)}>保存标签</Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* 保存前确认标签可见范围 */}
      {tagConfirm && tagTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/40 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-ink-900">确认保存学生标签？</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              公开标签会向学生及有权查看其资料的人显示；隐形标签只供获授权教职工内部查看，不会触发学生端彩蛋。请确认内容准确、尊重学生且符合学校管理规范。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTagConfirm(false)} disabled={tagsSaving}>返回修改</Button>
              <Button onClick={() => void saveTags()} loading={tagsSaving}>确认保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
