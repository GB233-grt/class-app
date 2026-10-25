/**
 * 学生加分面板（教师）：搜索/选择学生 → 加/扣积分 → 选择原因
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownCircle, ArrowUpCircle, Award, Search } from 'lucide-react';
import { studentsApi } from '../../../api';
import { useStudents } from '../../../hooks/useStudents';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { ErrorNotice } from '../../common/States';
import { Spinner } from '../../common/Spinner';
import { POINT_REASONS } from '../../../lib/constants';
import { teacherAwardFormSchema, type TeacherAwardFormValues } from '../../../lib/validation';
import { getErrorMessage } from '../../../lib/utils';
import type { Student } from '../../../types';

/** 按姓名或学号模糊匹配（不区分大小写） */
function matchesSearch(student: Student, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    student.name.toLowerCase().includes(q) ||
    (student.student_no ?? '').toLowerCase().includes(q)
  );
}

export function AwardPointsPanel() {
  const { showToast } = useToast();
  const { students, loading, error, refresh } = useStudents();
  // 学生搜索关键字（支持姓名 / 学号，解决大班级下拉难选的问题）
  const [search, setSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TeacherAwardFormValues>({
    resolver: zodResolver(teacherAwardFormSchema),
    defaultValues: { type: 'add', amount: '', reason: POINT_REASONS[0], student_id: '' },
  });

  const type = watch('type');
  const studentId = watch('student_id');
  // 仅学生可被加分（教师/管理员无积分概念），再按关键字过滤
  const studentOptions = students.filter(
    (student) => student.role === 'student' && matchesSearch(student, search),
  );
  const studentTotal = students.filter((student) => student.role === 'student').length;
  const selected = studentOptions.find((student) => student.id === studentId);

  // 搜索时若已选学生不在结果里，自动清空选择
  const handleSearch = (value: string) => {
    setSearch(value);
    const q = value.trim().toLowerCase();
    const current = students.find((student) => student.id === studentId && student.role === 'student');
    if (current && !matchesSearch(current, q)) {
      setValue('student_id', '', { shouldValidate: false });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const delta = values.type === 'add' ? Number(values.amount) : -Number(values.amount);
    try {
      const result = await studentsApi.award({
        student_id: values.student_id,
        delta,
        reason: values.reason,
      });
      showToast(
        'success',
        `${values.type === 'add' ? '加分' : '扣分'}成功，当前积分 ${result.balance_after}`,
      );
      reset({ type: 'add', amount: '', reason: POINT_REASONS[0], student_id: '' });
      setSearch('');
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, '积分调整失败，请稍后重试'));
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-ink-100 bg-white py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <ErrorNotice message={error} onRetry={() => void refresh()} />;
  }

  return (
    <Card className="animate-fade-up mx-auto max-w-2xl p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
        <Award className="h-5 w-5 text-brand-500" />
        学生积分奖励
      </h2>
      <p className="mb-5 text-sm text-ink-500">
        为学生的课堂表现、作业完成等即时加减积分，操作会记入学生的积分明细。
      </p>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="搜索学生"
              placeholder="输入姓名或学号，例如：张三 / S2024001"
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
            />
            <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-400">
              <Search className="h-3 w-3" />
              {search.trim() === ''
                ? `共 ${studentTotal} 名学生，输入关键字可快速筛选`
                : `匹配到 ${studentOptions.length} 名学生（共 ${studentTotal} 人）`}
            </p>
          </div>
          <Select
            label="选择学生"
            error={errors.student_id?.message}
            {...register('student_id')}
          >
            <option value="">请选择学生</option>
            {studentOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
                {student.student_no ? `（${student.student_no}）` : ''} · 当前 {student.points} 积分
              </option>
            ))}
            {studentOptions.length === 0 && (
              <option value="" disabled>
                {search.trim() === '' ? '暂无学生' : '没有匹配的学生，请更换关键字'}
              </option>
            )}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="调整类型" error={errors.type?.message} {...register('type')}>
            <option value="add">➕ 加分</option>
            <option value="deduct">➖ 扣分</option>
          </Select>
          <Input
            label="积分数量"
            type="number"
            min={1}
            placeholder="例如 10"
            error={errors.amount?.message}
            {...register('amount')}
          />
        </div>

        <Select label="变动原因" error={errors.reason?.message} {...register('reason')}>
          {POINT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </Select>

        {selected && (
          <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
            {selected.name} 当前积分：
            <span className="font-semibold text-brand-600">{selected.points}</span>
            {type === 'deduct' && Number(watch('amount')) > selected.points && (
              <span className="ml-2 text-red-500">⚠ 该学生积分不足以扣除</span>
            )}
          </p>
        )}

        <Button
          type="submit"
          loading={isSubmitting}
          className="w-full sm:w-auto"
          variant={type === 'deduct' ? 'danger' : 'primary'}
        >
          {type === 'deduct' ? (
            <>
              <ArrowDownCircle className="h-4 w-4" /> 确认扣分
            </>
          ) : (
            <>
              <ArrowUpCircle className="h-4 w-4" /> 确认加分
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
