/** @type {import('tailwindcss').Config} */

// ══════════════════════════════════════════════════════
//  PALETTE — change colours here, nowhere else.
//  After editing, restart the dev server once.
// ══════════════════════════════════════════════════════
const P = {
  appBg:     '#ffffff',   // page background (Dashboard)
  libBg:     '#f2f2f7',   // Biblioteka — iOS "grouped" bg (slightly darker)
  surface:   '#f2f2f7',   // cards, sections  — iOS secondary system bg
  surface2:  '#e8e8ed',   // inputs, chips    — iOS tertiary system bg
  border:    '#d1d1d6',   // hairline borders — iOS separator

  primary:   '#2e7d52',   // Nature green — buttons, active tab, CTAs
  primaryDk: '#1e5c3a',   // darker shade for hover / pressed
  primaryLt: '#eaf4ef',   // very light tint for pill backgrounds

  navBg:     '#ffffff',   // tab bar background (same everywhere)
  navActive: '#2e7d52',   // active tab icon + label
  navInactive:'#8e8e93',  // inactive — iOS secondary label grey
}

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Near-black for titles ─────────────────────
        gray: { 950: '#0d0d0d' },

        // ── Semantic tokens ────────────────────────────
        app:     { DEFAULT: P.appBg, warm: '#faf8f3' },  // app.warm — desktop right panel bg
        lib:     P.libBg,
        surface: { DEFAULT: P.surface, 2: P.surface2 },
        warm:    { border: P.border },
        primary: { DEFAULT: P.primary, dark: P.primaryDk, light: P.primaryLt },
        accent:  { DEFAULT: P.primary, deep: P.primaryDk },

        // ── Green scale ────────────────────────────────
        sage: {
          50:  '#edf5f0',
          100: '#d0e8da',
          200: '#a3d1b7',
          300: '#6db592',
          400: '#479970',
          500: P.primary,    // Nature green
          600: '#256843',
          700: P.primaryDk,
          800: '#164530',
          900: '#0d2e1f',
        },

        // ── Warm accent (kept for timeline/badges) ─────
        caramel: {
          50:  '#fefae0',
          100: '#faf0c4',
          200: '#f3dfa0',
          300: '#dda15e',
          400: '#bc6c25',
          500: '#9a5620',
          600: '#7d4419',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        ios:       '0 2px 12px rgba(0,0,0,0.06)',
        'ios-lg':  '0 8px 32px rgba(0,0,0,0.10)',
        'ios-card':'0 1px 3px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.09)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s cubic-bezier(0.32,0.72,0,1)',
        'fade-in':  'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
