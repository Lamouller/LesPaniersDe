import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          overlay: 'var(--bg-overlay)',
        },
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          hover: 'rgba(255,255,255,0.10)',
          border: 'rgba(255,255,255,0.10)',
          'border-hover': 'rgba(255,255,255,0.20)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        scaleIn: 'scaleIn 0.2s ease-out',
        slideInUp: 'slideInUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,255,255,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(255,255,255,0.2)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
