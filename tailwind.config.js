/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        earth: {
          50: '#faf8f3',
          100: '#f5f1e6',
          200: '#e8dfc7',
          300: '#d4c39f',
          400: '#b8a06f',
          500: '#9d8450',
          600: '#806940',
          700: '#654f32',
          800: '#4a3a25',
          900: '#31261a',
        },
      },
    },
  },
  plugins: [],
};
