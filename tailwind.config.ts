import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.vue',
    './components/**/*.vue',
    './composables/**/*.ts',
    './app.vue',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
