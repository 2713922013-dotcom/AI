/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2E8B57',
        'primary-light': '#3CB371',
        'primary-dark': '#1A6B3C',
        secondary: '#F5F7FA',
        accent: '#FF6B35',
        success: '#00C853',
        warning: '#FFD600',
        danger: '#FF1744',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
