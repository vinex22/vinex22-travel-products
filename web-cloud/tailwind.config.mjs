/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1d1d1f',
          soft: '#3a3a3c',
          mute: '#6e6e73'
        },
        paper: {
          DEFAULT: '#fbfbfd',
          warm: '#f5f5f7'
        },
        sienna: '#b75d3a',
        sand: '#d4c5a9'
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'Helvetica Neue', 'Helvetica', 'sans-serif']
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter2: '-0.025em'
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out both',
        'fade-in': 'fadeIn 1.2s ease-out both'
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    }
  },
  plugins: []
};
