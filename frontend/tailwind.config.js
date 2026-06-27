/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FBFAF7',
          100: '#F5F3ED',
        },
        ink: {
          50: '#F6F6F5',
          100: '#E8E7E3',
          300: '#9E9B91',
          500: '#4A4740',
          800: '#121110',
          900: '#0A0A08',
        },
        accent: {
          500: '#6D3AAD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,15,15,.03), 0 4px 12px rgba(15,15,15,.04)',
        medium: '0 2px 4px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.06)',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        lg: '14px',
      },
    },
  },
  plugins: [],
}
