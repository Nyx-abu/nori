import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FDFBF7',
        surface: '#FFFFFF',
        'surface-2': '#F3F0E6',
        border: '#1A1A1A',
        'border-hover': '#1A1A1A',
        'text-primary': '#1A1A1A',
        'text-secondary': '#4A4A4A',
        'text-muted': '#8A8A8A',
        accent: '#2A4B3C',
        'accent-glow': '#D4AF37',
        'accent-pink': '#F19CBB',
        'accent-blue': '#74A4F2',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Outfit', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '12px',
        xs: '13px',
        sm: '14px',
        base: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
        '5xl': '80px',
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        pill: '9999px',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
        enter: '500ms',
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Springy/Bouncy
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, #EAE5D9 1.5px, transparent 1.5px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        spin: 'spin 700ms linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
