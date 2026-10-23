/**
 * 新建学生面板：创建学生账号（同步创建 Supabase Auth 登录账号）
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { studentsApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { getErrorMessage } from '../../../lib/utils';
import { studentFormSchema, type StudentFormValues } from '../../../lib/validation';

const EMPTY_FORM = { name: '', student_no: '', email: '', password: '', points: '' };

export function CreateStudentPanel() {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await studentsApi.create({
        name: values.name,
        student_no: values.student_no || undefined,
        email: values.email,
        password: values.password,
        // 初始积分留空视为 0
        points: values.points === '' ? 0 : Number(values.points),
      });
      showToast('success', '学生创建成功，现在可以使用邮箱和密码登录了');
      reset(EMPTY_FORM);
    } catch (err) {
      showToast('error', getErrorMessage(err, '创建学生失败'));
    }
  });

  return (
    <Card className="animate-fade-up mx-auto max-w-2xl p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
        <UserPlus className="h-5 w-5 text-brand-500" />
        新建学生
      </h2>
      <p className="mb-5 text-sm text-ink-500">
        创建后学生即可使用邮箱和密码登录学生商店；初始积分大于 0 时会自动记入积分明细（初始积分）。
      </p>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="姓名"
            placeholder="学生姓名"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="学号"
            placeholder="选填，例如 S2024003"
            error={errors.student_no?.message}
            {...register('student_no')}
          />
        </div>
        <Input
          label="邮箱"
          type="email"
          placeholder="student@school.edu"
          error={errors.email?.message}
          {...register('email')}
        />
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
            {...register('points')}
          />
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
          创建学生
        </Button>
      </form>
    </Card>
  );
}
