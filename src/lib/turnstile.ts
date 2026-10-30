/**
 * Cloudflare Turnstile 人机验证封装
 * 文档：https://developers.cloudflare.com/turnstile/
 *
 * 安全模型：
 *   - 站点密钥（sitekey）是公开的，可安全写在前端代码里
 *   - 服务端验证密钥（secret）只配置在 Cloudflare Pages 环境变量，绝不下发
 *   - 用户验证后拿到的 token 只能使用一次，且必须由服务端调 siteverify 校验
 *
 * 启用步骤：
 *   1. Cloudflare 控制台 → Turnstile → Add site，拿到 Site Key 与 Secret Key
 *   2. 将下方 TURNSTILE_SITE_KEY 填为 Site Key（留空 = 不启用）
 *   3. Pages 项目设置 → Environment variables 添加 TURNSTILE_SECRET_KEY（两个标签页都加）
 *
 * 本地调试可用 Cloudflare 官方测试密钥（始终通过）：
 *   sitekey: 1x00000000000000000000AA   secret: 1x0000000000000000000000000000000AA
 */

/** 站点密钥（公开值）；留空 = 未启用，登录跳过人机校验 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFsbVGDUPSxgu-wN';

/** Turnstile 挂件运行时句柄（显式渲染模式） */
export interface TurnstileHandle {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
}

export interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  retry?: 'auto' | 'never';
  refreshExpired?: 'auto' | 'manual' | 'never';
}

declare global {
  interface Window {
    turnstile?: TurnstileHandle;
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * 按需加载 Turnstile 脚本（全局只加载一次，并发调用复用同一个 Promise）
 * 仅在真正需要渲染挂件时加载，不影响其他页面的首屏性能
 */
export function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // 加载失败允许下次重试
        reject(new Error('人机验证组件加载失败'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}
