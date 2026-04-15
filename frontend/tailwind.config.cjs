/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'netatmo-dark': '#1a1a1a',
        'netatmo-darker': '#0d0d0d',
      },
    },
  },
  plugins: [],
}
