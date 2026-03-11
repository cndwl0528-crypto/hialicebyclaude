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
        primary: '#5C8B5C',
        'primary-light': '#7AAE7A',
        'primary-dark': '#3D6B3D',
        'sky': '#87CEDB',
        'sky-light': '#A8DAEA',
        'sky-dark': '#5BA8B8',
        background: '#F5F0E8',
        'background-alt': '#EDE5D4',
        card: '#FFFCF3',
        accent: '#D4A843',
        'accent-light': '#E8C46A',
        'accent-dark': '#A8822E',
        success: '#7AC87A',
        'success-light': '#9ED89E',
        'success-dark': '#5CAF5C',
        danger: '#D4736B',
        'danger-light': '#E09891',
        'danger-dark': '#B85A53',
        'text-dark': '#3D2E1E',
        'text-mid': '#6B5744',
        'text-light': '#9B8777',
        'level-beginner': '#C8E6C9',
        'level-intermediate': '#FFE0B2',
        'level-advanced': '#E1BEE7',
        'ghibli-cream': '#FFFCF3',
        'ghibli-tan': '#D6C9A8',
        'ghibli-forest': '#3D6B3D',
        'ghibli-sky': '#87CEDB',
        'ghibli-gold': '#D4A843',
        'nav-bg': '#D6C9A8',
        'nav-border': '#C4B49A',
      },
      fontFamily: {
        sans: [
          'Nunito',
          'Quicksand',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        nunito: ['Nunito', 'sans-serif'],
        quicksand: ['Quicksand', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
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
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'ghibli': '0 4px 20px rgba(61,46,30,0.08)',
        'ghibli-hover': '0 8px 30px rgba(61,46,30,0.12)',
        'ghibli-card': '0 4px 20px rgba(61,46,30,0.06)',
      },
      animation: {
        'pulse-mic': 'pulse-mic 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'leaf-sway': 'leaf-sway 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        'pulse-mic': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'leaf-sway': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        shimmer: {
          '0%': { opacity: '0.6' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.6' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
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
