/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4ecca3',
        secondary: '#16213e',
        dark: '#1a1a2e',
        danger: '#ff4757',
        warning: '#ff9f43',
      }
    },
  },
  plugins: [],
}
