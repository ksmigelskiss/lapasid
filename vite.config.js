import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      // Restart CSS when tailwind config changes
      include: ['tailwind.config.js'],
    },
  },
})
