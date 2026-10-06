import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,ts}',
    './composables/**/*.ts',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        panel: {
          DEFAULT: '#18181a',
          deep: '#0e0e10',
          raised: '#232326',
          line: '#3a3a3f',
        },
        silk: {
          DEFAULT: '#e9e9e4',
          dim: '#9a9a96',
        },
        metal: {
          light: '#d4d6d9',
          DEFAULT: '#a9adb3',
          dark: '#6b6f75',
        },
        led: {
          DEFAULT: '#ff3b30',
          dim: '#4a1210',
        },
        wood: {
          light: '#a06b3c',
          DEFAULT: '#6f4423',
          dark: '#3b2211',
        },
        oled: {
          DEFAULT: '#d7f3ff',
          bg: '#05080a',
        },
      },
      fontFamily: {
        panel: ['"Barlow Condensed"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        oled: ['VT323', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
