/**
 * 通用工具函数
 */

/** 合并 CSS 类名（轻量版 clsx） */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** 格式化日期时间：YYYY-MM-DD HH:mm */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 格式化积分数字：千分位 */
export function formatPoints(value: number): string {
  return value.toLocaleString('zh-CN');
}

/** 将 Supabase Auth 的常见英文错误翻译为中文提示 */
export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return '邮箱或密码错误';
  if (message.includes('Email not confirmed')) return '邮箱尚未验证，请联系管理员在 Supabase 后台确认';
  if (message.includes('rate limit') || message.includes('Too many')) return '操作过于频繁，请稍后再试';
  if (message.includes('Unable to validate email address')) return '邮箱格式不正确';
  if (message.includes('Password should be at least')) return '密码长度不符合要求';
  if (message.includes('fetch') || message.includes('Failed to fetch')) {
    return '网络请求失败，请检查网络或 Supabase 配置';
  }
  return message;
}

/** 从未知异常中提取可展示的错误消息 */
export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}
