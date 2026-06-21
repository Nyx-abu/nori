import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        border: 'hsl(var(--border))',
        'border-hover': 'hsl(var(--border-hover))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-muted': 'hsl(var(--text-muted))',
        accent: 'hsl(var(--accent))',
        'accent-secondary': 'hsl(var(--accent-secondary))',
        'accent-glow': 'hsl(var(--accent-glow))',
        'accent-pink': 'hsl(var(--accent-pink))',
        'accent-blue': 'hsl(var(--accent-blue))',
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
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)', // Snappy Smooth
      },
    },
  },
  plugins: [],
}

export default config
