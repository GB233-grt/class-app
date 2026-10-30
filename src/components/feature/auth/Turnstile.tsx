/**
 * Cloudflare Turnstile 人机验证挂件
 * 显式渲染模式：脚本加载完成后渲染到容器，组件卸载时调用 remove 销毁
 * 回调通过 ref 转发，父组件重渲染不会导致挂件重复渲染
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { loadTurnstile, TURNSTILE_SITE_KEY } from '../../../lib/turnstile';

export interface TurnstileRef {
  /** 重置挂件：清空已有验证结果（登录失败后调用，让用户重新验证） */
  reset: () => void;
}

interface TurnstileProps {
  /** 验证成功获得 token 时回调 */
  onToken: (token: string) => void;
  /** 验证过期回调（token 已失效，需要重新验证） */
  onExpire?: () => void;
  /** 挂件加载或渲染失败回调 */
  onError?: () => void;
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onToken, onExpire, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    // 用 ref 保存最新回调，effect 只在挂载时执行一次，避免重复渲染挂件
    const callbacksRef = useRef({ onToken, onExpire, onError });
    callbacksRef.current = { onToken, onExpire, onError };

    useImperativeHandle(ref, () => ({
      reset: () => {
        window.turnstile?.reset(widgetIdRef.current ?? undefined);
      },
    }));

    useEffect(() => {
      let cancelled = false;

      loadTurnstile()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token) => callbacksRef.current.onToken(token),
            'expired-callback': () => callbacksRef.current.onExpire?.(),
            'error-callback': () => callbacksRef.current.onError?.(),
            theme: 'light',
            language: 'zh-CN',
            appearance: 'always',
            retry: 'auto',
            refreshExpired: 'auto',
          });
        })
        .catch(() => {
          if (!cancelled) callbacksRef.current.onError?.();
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, []);

    // min-h 防止挂件加载期间表单布局抖动
    return <div ref={containerRef} className="flex min-h-[70px] items-center" />;
  },
);

Turnstile.displayName = 'Turnstile';
