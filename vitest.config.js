import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Atskiras config (ne vite.config.js) — kad testai nekrautų VitePWA plugin'o.
// Testuojam TIK grynus duomenų util'us (forecasts, toxicity, notes, recovery) —
// be DOM, be Firebase, be render'inimo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // src/** — grynų duomenų util'ų testai (forecasts, toxicity, notes, transform).
    // api/** — serverless funkcijų grynoji logika (auth limitai, token verifikacija,
    //          vision cookie algoritmas). Žr. docs/AI_REVIEW.md §6.
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.{js,mjs}'],
  },
})
