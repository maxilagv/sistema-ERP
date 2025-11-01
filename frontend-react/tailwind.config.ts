import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(139,92,246,0.35), 0 10px 25px rgba(34,211,238,0.12), 0 4px 8px rgba(139,92,246,0.25)',
        innerGlow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'neon-grid': 'radial-gradient(ellipse at 20% 10%, rgba(139,92,246,0.18), transparent 40%), radial-gradient(ellipse at 80% 20%, rgba(34,211,238,0.18), transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.12), transparent 50%)',
      },
    },
  },
  darkMode: 'class',
  plugins: [],
} satisfies Config
