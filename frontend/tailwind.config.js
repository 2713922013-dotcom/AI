/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C7BFF',
          light: '#8B9AFF',
          dark: '#4F5CD6',
        },
        secondary: '#38BDF8',
        accent: '#9B6DFF',
        'accent-pink': '#FF7FD1',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',

        // Dark theme colors
        'dark': {
          bg: '#050816',
          card: '#0A1020',
          surface: '#111827',
          border: 'rgba(255,255,255,0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'HarmonyOS Sans', 'Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '28px',
      },
      boxShadow: {
        'glass': '0 10px 40px rgba(0,0,0,0.3)',
        'glass-hover': '0 16px 48px rgba(0,0,0,0.45)',
        'glow-blue': '0 0 30px rgba(108,123,255,0.25)',
        'glow-purple': '0 0 30px rgba(139,92,246,0.25)',
        'glow-pink': '0 0 20px rgba(255,127,209,0.2)',
      },
      backdropBlur: {
        'glass': '20px',
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.8s ease-out both',
        'scale-in': 'scale-in 0.4s ease-out both',
        'float-slow': 'float 5s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'aurora': 'aurora-shift 12s ease infinite',
        'shimmer-dark': 'shimmer-dark 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
