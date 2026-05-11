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

        // ── LapasID Brandbook (v1.0 · 2026) ─────────────
        // T4 logo + Forest/Bone/Terracotta paletė. Greta sage scale'o
        // (kuris liks transition periodu), gradually migruojam vizualius
        // elementus į brand tokens'us.
        forest: {
          50:  '#e8efe9',
          100: '#c7d6c9',
          200: '#9bb7a0',
          300: '#6e9778',
          400: '#456d52',
          500: '#2e5238',
          600: '#264530',
          700: '#1c3a2a',  // INK — pagrindinė brand spalva
          800: '#142b1f',
          900: '#0c1c14',
        },
        bone: {
          DEFAULT: '#f1ebdd',  // PAPER — pagrindinis warm cream'as
          50:      '#faf6ec',
          100:     '#f4eedf',
          200:     '#f1ebdd',  // = DEFAULT
          300:     '#e7e0cf',  // browser chrome'ui ir kt
          400:     '#d8cfb8',
        },
        terracotta: {
          DEFAULT: '#b86a3a',  // ACCENT — sparingly, callouts only
          50:      '#f8ece2',
          100:     '#efd2bb',
          200:     '#dba887',
          300:     '#c88456',
          400:     '#b86a3a',  // = DEFAULT
          500:     '#9a5328',
          600:     '#7c411f',
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
        // Brand display + body. System fonts kaip fallback'as kol Bricolage neužkraunamas.
        sans:    ['"Bricolage Grotesque"', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        // Brand button shape — staciakampis užapvalintas (panašus į logo/ikonos
        // proporcijas), naudojamas vietoj rounded-full ant action mygtukų.
        // Pill forma (rounded-full) lieka avatarams, status pill'ams ir badge'ams.
        'btn':    '0.875rem',  // 14px — toolbar/tab/modal action buttons
        'btn-sm': '0.625rem',  // 10px — small icon-only buttons (search, bell, close)
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
