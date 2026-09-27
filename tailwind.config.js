/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface-2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        green: 'rgb(var(--green) / <alpha-value>)',
        greenSoft: 'rgb(var(--green-soft) / <alpha-value>)',
        lake: 'rgb(var(--lake) / <alpha-value>)',
        terra: 'rgb(var(--terra) / <alpha-value>)',
        terraSoft: 'rgb(var(--terra-soft) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        lemon: 'rgb(var(--lemon) / <alpha-value>)',
        olive: 'rgb(var(--olive) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Secular One"', 'Assistant', 'system-ui', 'sans-serif'],
        sans: ['Assistant', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
        float: '0 6px 20px -6px rgb(0 0 0 / 0.28)',
      },
    },
  },
  plugins: [],
}
