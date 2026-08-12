/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'DejaVu Sans', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'DejaVu Sans Mono', 'Liberation Mono', 'monospace'],
        temperature: ['Inter Tight', 'Inter', 'Noto Sans', 'DejaVu Sans', 'Arial', 'sans-serif'],
      },
      colors: {
        'netatmo-dark': '#1a1a1a',
        'netatmo-darker': '#0d0d0d',
      },
    },
  },
  plugins: [],
}
