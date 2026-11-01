/**
 * 修改密码表单：旧密码 + 新密码 + 确认新密码
 * 需要密码强度校验（8 位+）
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, KeyRound, PackageCheck, ShieldCheck, XCircle } from 'lucide-react';
import { authApi, userApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { passwordFormSchema, PasswordFormValues, profileFormSchema, ProfileFormValues } from '../../../lib/validation';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import type { Student } from '../../../types';

/** 修改密码 → 资料 → 注销账号 */
type SettingTab = 'password' | 'profile' | 'danger';

const TABS: { key: SettingTab; label: string; icon: typeof KeyRound }[] = [
  { key: 'password', label: '修改密码', icon: KeyRound },
  { key: 'profile', label: '个人资料', icon: PackageCheck },
  { key: 'danger', label: '注销账号', icon: XCircle },
];

interface SettingsPanelProps {
  profile: Student;
  onUpdated: () => void;
}

export function SettingsPanel({ profile, onUpdated }: SettingsPanelProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingTab>('password');
  const [updating, setUpdating] = useState(false);

  const password = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: profile.name, student_no: profile.student_no ?? '' },
  });

  const handlePassword = password.handleSubmit(async (values) => {
    try {
      await authApi.changePassword(values);
      showToast('success', '密码修改成功，请用新密码重新登录');
      password.reset({ old_password: '', new_password: '', confirm_password: '' });
      onUpdated();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '修改密码失败，请稍后重试');
    }
  });

  const handleProfile = profileForm.handleSubmit(async (values) => {
    setUpdating(true);
    try {
      const { name, student_no } = values;
      const payload = {
        name: name?.trim() || undefined,
        student_no: student_no?.trim() || undefined,
      };
      await userApi.update(payload);
      showToast('success', '资料已更新');
      profileForm.reset({ name, student_no });
      onUpdated();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '修改资料失败，请稍后重试');
    } finally {
      setUpdating(false);
    }
  });

  const handleDelete = async () => {
    const ok = window.confirm(
      '确认要注销账号吗？\n' +
        '注意：注销后积分、兑换记录、所有历史数据将永久删除，无法恢复。\n' +
        '请确保您了解该操作的后果。',
    );
    if (!ok) return;
    const passwordInput = window.prompt('请输入您的登录密码以确认：');
    if (passwordInput === null) return;
    try {
      await userApi.deleteAccount();
      showToast('success', '账号已注销');
      onUpdated();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '注销账号失败，请稍后重试');
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      {/* 选项卡导航 */}
      <div className="flex gap-2 border-b border-ink-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors' +
              (activeTab === tab.key ? ' text-brand-700' : ' text-ink-500 hover:text-ink-700')
            }
          >
            <tab.icon className={activeTab === tab.key ? 'h-4 w-4 text-brand-600' : 'h-4 w-4 text-ink-400'} />
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'password' && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-900">修改密码</h2>
          <p className="mb-6 text-sm text-ink-500">
            修改密码前需要再次确认旧密码，新密码会被加盐哈希处理（不可逆），请妥善保管。
          </p>
          <form className="space-y-4" onSubmit={handlePassword} noValidate>
            <Input
              label="当前（旧）密码"
              type="password"
              placeholder="请输入旧密码"
              error={password.formState.errors.old_password?.message}
              {...password.register('old_password')}
            />
            <Input
              label="新密码"
              type="password"
              placeholder="至少 8 位，包含大小写/数字/特殊字符"
              error={password.formState.errors.new_password?.message}
              {...password.register('new_password')}
            />
            <Input
              label="重复新密码"
              type="password"
              placeholder="请再次输入新密码"
              error={password.formState.errors.confirm_password?.message}
              {...password.register('confirm_password')}
            />
            <p className="text-xs text-ink-400">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              密码经不可逆加盐哈希存储，无法查看原始密码
            </p>
            <Button type="submit" className="w-full" loading={updating}>
              确认修改密码
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'profile' && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-900">个人资料</h2>
          <p className="mb-6 text-sm text-ink-500">修改昵称或学号后，标签/列表页会及时更新。</p>
          <form className="space-y-4" onSubmit={handleProfile} noValidate>
            <Input
              label="昵称"
              placeholder="请输入曾用名（最多 20 个）"
              error={profileForm.formState.errors.name?.message}
              {...profileForm.register('name')}
            />
            <Input
              label="学号"
              placeholder="请输入学号（选填，最多 20 个）"
              error={profileForm.formState.errors.student_no?.message}
              {...profileForm.register('student_no')}
            />
            <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              邮箱：{profile.email}（邮箱为登录凭证，请勿修改）
            </div>
            <Button type="submit" className="w-full" loading={updating}>
              保存修改
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'danger' && (
        <Card className="border-red-200 p-6">
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-bold text-red-900">注销账号</h2>
          </div>
          <p className="mb-6 text-sm text-red-700">
            注销后您的积分、兑换记录、所有历史数据将无法恢复，此操作不可逆。
          </p>
          <div className="flex gap-3">
            <Button variant="danger" className="w-full" onClick={handleDelete}>
              确认注销账号
            </Button>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            注销前建议先修改密码并确认已登录（旧密码校验）
          </p>
        </Card>
      )}
    </div>
  );
}
