import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 配置：开发服务器将 /api 请求代理到本地 Cloudflare Pages Functions（wrangler pages dev）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
});
