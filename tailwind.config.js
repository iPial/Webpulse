/** @type {import('tailwindcss').Config} */
const defaultColors = require('tailwindcss/colors');

module.exports = {
  content: [
    './src/app/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ───── existing tokens (kept for current dark-themed pages) ─────
        score: {
          good: '#10B981',
          average: '#F59E0B',
          poor: '#EF4444',
        },

        // ───── redesign tokens (paper + soft-3D) ─────
        // Neutrals
        paper: '#F3EFE6',
        'paper-2': '#EDE7D8',
        surface: '#FFFDF8',
        'surface-2': '#FBF7EC',
        ink: {
          DEFAULT: '#0E0D10',
          2: '#2A2530',
        },
        muted: '#6B6574',
        line: {
          DEFAULT: '#E9E2D2',
          2: '#D7CEB8',
        },

        // Brand — merged with Tailwind defaults so bg-lime-500 / bg-orange-500 etc. still resolve
        lime: {
          ...defaultColors.lime,
          DEFAULT: '#D6FF3C',
          deep: '#B8E62F',
          ink: '#1F2605',
        },
        orange: {
          ...defaultColors.orange,
          DEFAULT: '#FF5C35',
        },
        violet: {
          ...defaultColors.violet,
          DEFAULT: '#7B5CFF',
        },
        sky: {
          ...defaultColors.sky,
          DEFAULT: '#BEE5FF',
        },
        rose: {
          ...defaultColors.rose,
          DEFAULT: '#FFC2D1',
        },
        cobalt: '#1E40FF',

        // Semantic
        good: {
          DEFAULT: '#0EA86B',
          bg: '#D4F5E4',
        },
        warn: {
          DEFAULT: '#F59E0B',
          bg: '#FFE9C2',
        },
        bad: {
          DEFAULT: '#E0342B',
          bg: '#FFD9D5',
        },
      },

      // Redesign radii — prefixed `r-*` so they don't collide with Tailwind defaults (rounded-lg stays 8px).
      borderRadius: {
        'r-xs': '8px',
        'r-sm': '12px',
        'r-md': '18px',
        'r-lg': '24px',
        'r-xl': '32px',
        'r-pill': '9999px',
      },

      // Redesign shadows — numeric keys avoid collision with Tailwind defaults (shadow-sm / -md / -lg).
      boxShadow: {
        '1': '0 1px 2px rgba(10, 9, 11, 0.04), 0 2px 6px rgba(10, 9, 11, 0.04)',
        '2': '0 1px 2px rgba(10, 9, 11, 0.05), 0 8px 20px rgba(10, 9, 11, 0.06)',
        '3': '0 1px 3px rgba(10, 9, 11, 0.06), 0 20px 40px rgba(10, 9, 11, 0.08)',
        lime: '0 8px 24px -8px rgba(184, 230, 47, 0.55)',
        orange: '0 8px 24px -8px rgba(255, 92, 53, 0.45)',
        ink: '0 12px 28px -12px rgba(14, 13, 16, 0.55)',
      },

      // Font families — wire to next/font CSS vars from layout.jsx
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
