/**
 * envctrl · Tailwind theme extension — mirrors web/src/design/tokens.css.
 * Keep in sync when adding tokens. If you change a CSS var, change it here too.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          1: '#1a0b2e',
          2: '#2d1155',
          3: '#5b1769',
          4: '#831843',
          5: '#be185d',
        },
        glass: {
          1: 'rgba(255,255,255,0.08)',
          2: 'rgba(255,255,255,0.12)',
          3: 'rgba(255,255,255,0.18)',
          border: 'rgba(255,255,255,0.18)',
          'border-strong': 'rgba(255,255,255,0.28)',
        },
        ink: {
          DEFAULT: '#ffffff',
          2: 'rgba(255,255,255,0.75)',
          3: 'rgba(255,255,255,0.55)',
          4: 'rgba(255,255,255,0.35)',
          5: 'rgba(255,255,255,0.20)',
        },
        ok: { DEFAULT: '#6ee7b7', glow: 'rgba(110,231,183,0.4)' },
        warn: { DEFAULT: '#fcd34d', glow: 'rgba(252,211,77,0.4)' },
        crit: { DEFAULT: '#fda4af', glow: 'rgba(253,164,175,0.45)' },
        info: { DEFAULT: '#93c5fd', glow: 'rgba(147,197,253,0.4)' },
        accent: { DEFAULT: '#a5b4fc', glow: 'rgba(165,180,252,0.4)' },
        hot: { DEFAULT: '#f472b6', glow: 'rgba(244,114,182,0.4)' },
        cyan: { DEFAULT: '#67e8f9', glow: 'rgba(103,232,249,0.4)' },
        chart: {
          1: '#a78bfa',
          2: '#67e8f9',
          3: '#fcd34d',
          4: '#6ee7b7',
          5: '#f472b6',
          6: '#93c5fd',
          threshold: '#fda4af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '24px',
        pill: '999px',
      },
      boxShadow: {
        1: '0 4px 16px rgba(0,0,0,0.18)',
        2: '0 8px 32px rgba(0,0,0,0.25)',
        3: '0 16px 48px rgba(0,0,0,0.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      backdropBlur: {
        glass: '24px',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        breath: '2500ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'pulse-breath': {
          '0%, 100%': { boxShadow: '0 0 6px var(--ok-glow)' },
          '50%': { boxShadow: '0 0 12px var(--ok-glow), 0 0 20px rgba(110,231,183,0.2)' },
        },
        'cell-flash': {
          '0%': { background: 'rgba(167,139,250,0.18)' },
          '100%': { background: 'transparent' },
        },
      },
      animation: {
        'pulse-breath': 'pulse-breath 2.5s ease-in-out infinite',
        'cell-flash': 'cell-flash 600ms ease-out',
      },
    },
  },
  plugins: [],
};