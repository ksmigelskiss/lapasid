import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Atskiras config (ne vite.config.js) — kad testai nekrautų VitePWA plugin'o.
// Testuojam TIK grynus duomenų util'us (forecasts, toxicity, notes, recovery) —
// be DOM, be Firebase, be render'inimo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
