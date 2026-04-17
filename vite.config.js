import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'],
      manifest: {
        name: 'Gėlių žinynas',
        short_name: 'Gėlės',
        description: 'Asmeninis augalų žinynas',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#748962',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'apple touch icon' },
        ],
      },
      workbox: {
        // Cache app shell + static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Firebase, Anthropic, image APIs — network-first so data stays fresh
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/(www\.inaturalist\.org|upload\.wikimedia\.org)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'plant-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    watch: {
      include: ['tailwind.config.js'],
    },
  },
})
