/**
 * 学生管理面板：学生列表（表格）+ 积分增减操作
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus, Users } from 'lucide-react';
import { studentsApi } from '../../../api';
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
      header: '邮箱',
      render: (student) => <span className="text-ink-500">{student.email}</span>,
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
    </div>
  );
}
