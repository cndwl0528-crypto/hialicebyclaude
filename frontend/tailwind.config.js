/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4A90D9',
        'primary-light': '#6BA3E5',
        'primary-dark': '#2E5AA6',
        background: '#F5F7FA',
        'background-alt': '#EAECEF',
        accent: '#F39C12',
        'accent-light': '#F5AD3D',
        'accent-dark': '#D68910',
        success: '#27AE60',
        'success-light': '#52BE80',
        'success-dark': '#1E8449',
        danger: '#E74C3C',
        'danger-light': '#EC7063',
        'danger-dark': '#C0392B',
        'level-beginner': '#A8E6CF',
        'level-intermediate': '#FFD3B6',
        'level-advanced': '#F8B195',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      spacing: {
        'touch-min': '3rem', // 48px minimum touch target
      },
      minHeight: {
        'touch-min': '3rem', // 48px
      },
      minWidth: {
        'touch-min': '3rem', // 48px
      },
      animation: {
        'pulse-mic': 'pulse-mic 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-mic': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      gap: {
        'touch-safe': '0.5rem', // 8px minimum button spacing
      },
    },
  },
  plugins: [],
};

module.exports = config;
