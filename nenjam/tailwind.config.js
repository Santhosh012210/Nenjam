/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fdf8f6',
          100: '#faf0eb',
          200: '#f5e0d7',
        },
        plum: {
          50: '#f9f0fb',
          100: '#f1d9f7',
          200: '#e4b3ef',
          300: '#d080e3',
          400: '#b94fd4',
          500: '#9a2fb9',
          600: '#7c1a9a',
          700: '#621278',
          800: '#4a1255',
          900: '#2d0a2e',
        },
      },
      fontFamily: {
        sans: ['Noto Sans', 'Noto Sans Tamil', 'system-ui', 'sans-serif'],
        tamil: ['Noto Sans Tamil', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
