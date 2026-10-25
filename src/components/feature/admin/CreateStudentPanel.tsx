/**
 * 新建用户面板：创建学生/教师账号（同步创建 Supabase Auth 登录账号）
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { studentsApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { getErrorMessage } from '../../../lib/utils';
import { studentFormSchema, type StudentFormValues } from '../../../lib/validation';

const EMPTY_FORM = {
  name: '',
  student_no: '',
  email: '',
  password: '',
  points: '',
  role: 'student',
} as const;

export function CreateStudentPanel() {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const role = watch('role');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await studentsApi.create({
        name: values.name,
        student_no: values.student_no || undefined,
        email: values.email,
        password: values.password,
        // 初始积分留空视为 0；教师账号无积分概念，强制为 0
        points: values.role === 'teacher' ? 0 : values.points === '' ? 0 : Number(values.points),
        role: values.role,
      });
      showToast(
        'success',
        values.role === 'teacher'
          ? '教师账号创建成功，可以使用邮箱和密码登录教师工作台了'
          : '学生创建成功，现在可以使用邮箱和密码登录了',
      );
      reset(EMPTY_FORM);
    } catch (err) {
      showToast('error', getErrorMessage(err, '创建用户失败'));
    }
  });

  return (
    <Card className="animate-fade-up mx-auto max-w-2xl p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
        <UserPlus className="h-5 w-5 text-brand-500" />
        新建用户
      </h2>
      <p className="mb-5 text-sm text-ink-500">
        学生登录学生商店兑换物品；教师登录教师工作台（兑换发放确认 + 学生加分）。初始积分大于 0
        时会自动记入积分明细。
      </p>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="角色" error={errors.role?.message} {...register('role')}>
            <option value="student">学生</option>
            <option value="teacher">教师</option>
          </Select>
          <Input
            label="姓名"
            placeholder={role === 'teacher' ? '教师姓名' : '学生姓名'}
            error={errors.name?.message}
            {...register('name')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="学号"
            placeholder="选填，例如 S2024003"
            error={errors.student_no?.message}
            {...register('student_no')}
          />
          <Input
            label="邮箱"
            type="email"
            placeholder="someone@school.edu"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="初始密码"
            type="password"
            placeholder="至少 6 位"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="初始积分"
            type="number"
            min={0}
            placeholder="0"
            error={errors.points?.message}
            disabled={role === 'teacher'}
            {...register('points')}
          />
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
          创建{role === 'teacher' ? '教师' : '学生'}
        </Button>
      </form>
    </Card>
  );
}
