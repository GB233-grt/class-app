/**
 * 登录页：左右分栏（桌面端左侧品牌展示区 + 右侧登录表单）
 */
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BarChart3, Coins, GraduationCap, Info, ShoppingBag, type LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Turnstile, type TurnstileRef } from '../components/feature/auth/Turnstile';
import { DEMO_ACCOUNTS } from '../lib/constants';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';
import { loginSchema, type LoginValues } from '../lib/validation';
import { getErrorMessage } from '../lib/utils';

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: Coins, text: '积分激励 —— 良好表现即时兑现' },
  { icon: ShoppingBag, text: '物品兑换 —— 学校商店随心换' },
  { icon: BarChart3, text: '成长记录 —— 积分明细有据可查' },
];

export default function LoginPage() {
  const { login, sendPasswordReset } = useAuth();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // Cloudflare Turnstile 人机验证
  const turnstileRef = useRef<TurnstileRef>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileEnabled = TURNSTILE_SITE_KEY !== '';

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // 登录（Supabase Auth 邮箱密码 + Turnstile 人机校验）
  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    // 已配置站点密钥时，必须先完成人机验证
    if (turnstileEnabled && !captchaToken) {
      setError('请先完成下方的人机验证');
      return;
    }
    try {
      await login(values.email, values.password, captchaToken ?? undefined);
    } catch (err) {
      setError(getErrorMessage(err, '登录失败，请稍后重试'));
      // 登录失败后重置验证码：token 一次性使用，需让用户重新验证
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  });

  // 忘记密码：使用当前输入的邮箱发送重置邮件
  const handleResetPassword = async () => {
    const email = getValues('email');
    if (!email) {
      setError('请先输入注册邮箱，再点击"忘记密码"');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordReset(email);
      showToast('success', '重置邮件已发送，请查收邮箱');
    } catch (err) {
      showToast('error', getErrorMessage(err, '发送重置邮件失败'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* 左侧品牌展示区（桌面端） */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        {/* 装饰渐变 */}
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold">积分商城</span>
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl font-bold leading-snug">
            让每一份努力
            <br />
            都看得见回报
          </h1>
          <p className="mt-4 max-w-md text-white/60">
            学生通过课堂表现、作业完成等良好表现获得积分，并用积分兑换学校商店中的心仪物品。
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="h-4 w-4 text-brand-400" />
                </span>
                {feature.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/40">
          © {new Date().getFullYear()} 学生积分奖励平台
        </p>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-up">
          {/* 移动端 Logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="font-display text-xl font-bold text-ink-900">积分商城</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink-900">欢迎回来</h2>
          <p className="mt-1 text-sm text-ink-500">请登录你的账号，继续积分之旅</p>

          {/* 错误提示 */}
          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <Input
              label="邮箱"
              type="email"
              placeholder="you@school.edu"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <Input
                label="密码"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={resetting}
                  className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 disabled:opacity-60"
                >
                  {resetting ? '发送中…' : '忘记密码？'}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile 人机验证（仅在配置站点密钥后渲染） */}
            {turnstileEnabled && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  onToken={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setError('人机验证组件加载失败，请检查网络后刷新页面')}
                />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              登录
            </Button>
          </form>

          {/* 演示账号提示框 */}
          <div className="mt-8 rounded-lg border border-ink-200 bg-white p-4 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-ink-700">
              <Info className="h-4 w-4 text-brand-500" />
              演示账号
            </p>
            <ul className="mt-2 space-y-1 text-ink-500">
              <li>管理员：{DEMO_ACCOUNTS.admin}</li>
              <li>学生：{DEMO_ACCOUNTS.student}</li>
            </ul>
            <p className="mt-2 text-xs text-ink-400">
              账号由管理员在 Supabase 后台创建，密码请向管理员获取（此处不显示密码）。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
