/**
 * 账户设置面板：修改密码 / 个人资料 / 注销账号
 * · 修改密码：旧密码确认 + 新密码强度校验，密码由 Supabase Auth 加盐哈希存储
 * · 个人资料：昵称 / 学号，受管理员「系统设置」开关控制，关闭后禁用
 * · 注销账号：二次确认 + 旧密码校验，不可逆
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  PackageCheck,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { authApi, userApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import {
  passwordFormSchema,
  type PasswordFormValues,
  profileFormSchema,
  type ProfileFormValues,
} from '../../../lib/validation';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { PasswordRules } from '../../common/PasswordRules';
import { getErrorMessage } from '../../../lib/utils';
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
  /** 是否允许自助修改个人信息（默认关闭，读取到管理员配置后再放开） */
  const [allowProfileEdit, setAllowProfileEdit] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 读取系统配置：管理员可在「系统设置」中开关「学生自助修改个人信息」
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await userApi.getSystemSettings();
        if (cancelled) return;
        const record = settings.find((item) => item.key === 'allow_profile_edit');
        setAllowProfileEdit(record?.value?.enabled === true);
      } catch {
        // 读取失败按关闭处理（与后端一致）
        if (!cancelled) setAllowProfileEdit(false);
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const password = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: profile.name, student_no: profile.student_no ?? '' },
  });

  const handlePassword = password.handleSubmit(async (values) => {
    setUpdating(true);
    try {
      await authApi.changePassword(values);
      showToast('success', '密码修改成功，下次登录请使用新密码');
      password.reset({ old_password: '', new_password: '', confirm_password: '' });
      onUpdated();
    } catch (err) {
      showToast('error', getErrorMessage(err, '修改密码失败，请稍后重试'));
    } finally {
      setUpdating(false);
    }
  });

  const handleProfile = profileForm.handleSubmit(async (values) => {
    if (!allowProfileEdit) {
      showToast('error', '管理员已关闭修改个人信息功能，请联系管理员');
      return;
    }
    setUpdating(true);
    try {
      const { name, student_no } = values;
      await userApi.update({
        name: name?.trim() || undefined,
        student_no: student_no?.trim() || undefined,
      });
      showToast('success', '资料已更新');
      profileForm.reset({ name, student_no });
      onUpdated();
    } catch (err) {
      showToast('error', getErrorMessage(err, '修改资料失败，请稍后重试'));
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
    if (!passwordInput.trim()) {
      showToast('error', '请输入登录密码后再注销');
      return;
    }
    try {
      await userApi.deleteAccount(passwordInput);
      showToast('success', '账号已注销');
      onUpdated();
    } catch (err) {
      showToast('error', getErrorMessage(err, '注销账号失败，请稍后重试'));
    }
  };

  const permissionsLocked = !settingsLoaded || !allowProfileEdit;

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
            <tab.icon
              className={activeTab === tab.key ? 'h-4 w-4 text-brand-600' : 'h-4 w-4 text-ink-400'}
            />
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
              autoComplete="current-password"
              placeholder="请输入旧密码"
              error={password.formState.errors.old_password?.message}
              {...password.register('old_password')}
            />
            <Input
              label="新密码"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位，包含大小写 / 数字 / 特殊字符"
              error={password.formState.errors.new_password?.message}
              {...password.register('new_password')}
            />
            <PasswordRules value={password.watch('new_password') ?? ''} />
            <Input
              label="重复新密码"
              type="password"
              autoComplete="new-password"
              placeholder="请再次输入新密码"
              error={password.formState.errors.confirm_password?.message}
              {...password.register('confirm_password')}
            />
            <p className="text-xs text-ink-400">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              密码经不可逆加盐哈希存储，服务端无法查看原始密码
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
          {!settingsLoaded ? (
            <p className="mb-6 text-sm text-ink-400">正在读取权限配置…</p>
          ) : permissionsLocked ? (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                管理员已关闭「自助修改个人信息」功能。如需修改昵称或学号，请联系管理员在「学生管理」中调整。
              </span>
            </div>
          ) : (
            <p className="mb-6 text-sm text-ink-500">修改昵称或学号后，列表页会及时更新。</p>
          )}
          <form className="space-y-4" onSubmit={handleProfile} noValidate>
            <Input
              label="昵称"
              placeholder="请输入昵称（最多 20 个字符）"
              error={profileForm.formState.errors.name?.message}
              disabled={permissionsLocked}
              {...profileForm.register('name')}
            />
            <Input
              label="学号"
              placeholder="请输入学号（选填，最多 20 个字符）"
              error={profileForm.formState.errors.student_no?.message}
              disabled={permissionsLocked}
              {...profileForm.register('student_no')}
            />
            <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              邮箱：{profile.email}（邮箱为登录凭证，不支持自助修改）
            </div>
            <Button type="submit" className="w-full" loading={updating} disabled={permissionsLocked}>
              {permissionsLocked ? '管理员已关闭该功能' : '保存修改'}
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
          <Button variant="danger" className="w-full" onClick={handleDelete}>
            确认注销账号
          </Button>
          <p className="mt-4 text-xs text-ink-400">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            注销时将再次校验登录密码，确保为本人操作
          </p>
        </Card>
      )}
    </div>
  );
}
