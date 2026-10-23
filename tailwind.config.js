/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌色：深青绿/翠绿色系（主色 brand-500 附近 #16C987）
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#3fdca0',
          500: '#16C987',
          600: '#0ea86f',
          700: '#0c855a',
          800: '#0b6949',
          900: '#0a563e',
          950: '#053023',
        },
        // 中性色：近黑到浅灰（ink-950 近似 #0a0a0a）
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9dadf',
          300: '#b9bbc3',
          400: '#9598a4',
          500: '#787b89',
          600: '#5d606e',
          700: '#4a4c58',
          800: '#33343d',
          900: '#1c1d23',
          950: '#0a0a0a',
        },
        // 强调色：橙色（用于渐变装饰）
        accent: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      fontFamily: {
        // 标题字体：Plus Jakarta Sans + 中文友好的 Noto Sans SC
        display: ['"Plus Jakarta Sans"', '"Noto Sans SC"', 'sans-serif'],
        // 正文字体：Inter + Noto Sans SC
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(10, 10, 10, 0.06)',
      },
      keyframes: {
        // 列表渐入动画：向上淡入
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Toast 弹出动画：从底部弹出
        pop: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        pop: 'pop 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
