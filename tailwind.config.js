/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        score: {
          good: '#10B981',
          average: '#F59E0B',
          poor: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};
