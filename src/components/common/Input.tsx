/**
 * 通用表单输入框：label + error/hint 提示
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const BASE_CLASSES =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 ' +
  'placeholder:text-ink-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink-700">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            BASE_CLASSES,
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-400">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
