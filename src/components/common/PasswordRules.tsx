/**
 * 密码强度规则清单（实时打勾）
 *
 * 规则来源：src/lib/validation.ts 的 passwordStrengthExp / checkPasswordStrength，
 * 与后端 functions/api/auth/change-password.ts 的校验保持一致——两边必须同步改。
 *
 * 说明：规则本身是公开信息，写在页面上不降低安全性；
 *      系统从不存储明文密码，也不向前端暴露哈希参数。
 */
import { Check, X } from 'lucide-react';
import { passwordStrengthExp } from '../../lib/validation';
import { cn } from '../../lib/utils';

interface Rule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

const RULES: Rule[] = [
  {
    key: 'length',
    label: `长度至少 ${passwordStrengthExp.minLength} 位`,
    test: (value) => value.length >= passwordStrengthExp.minLength,
  },
  { key: 'upper', label: '包含大写英文字母（A-Z）', test: (v) => passwordStrengthExp.upper.test(v) },
  { key: 'lower', label: '包含小写英文字母（a-z）', test: (v) => passwordStrengthExp.lower.test(v) },
  { key: 'digit', label: '包含数字（0-9）', test: (v) => passwordStrengthExp.digit.test(v) },
  {
    key: 'special',
    label: '包含特殊字符（如 ! @ # $ % ^ & *）',
    test: (v) => passwordStrengthExp.special.test(v),
  },
];

export function PasswordRules({ value, className }: { value: string; className?: string }) {
  const passed = RULES.filter((rule) => rule.test(value)).length;

  return (
    <div className={cn('rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2.5', className)}>
      <p className="mb-1.5 text-xs font-medium text-ink-600">
        密码要求（{passed}/{RULES.length}）
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li
              key={rule.key}
              className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-emerald-600' : 'text-ink-400')}
            >
              {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
