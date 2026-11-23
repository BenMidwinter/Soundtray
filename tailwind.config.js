/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oak: '#d4a373',
        mahogany: '#5c2c16',
        walnut: '#3b1d0e',
        parchment: '#faedcd',
        cream: '#fefae0',
        amberWarm: '#e09f3e',
        moss: '#606c38',
        terracotta: '#b5442b',
      },
    },
  },
  plugins: [],
};
