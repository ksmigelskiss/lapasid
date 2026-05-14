import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: [
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
        'apple-touch-icon.png', 'favicon-32.png', 'favicon-16.png',
      ],
      manifest: {
        name: 'LapasID',
        short_name: 'LapasID',
        description: 'Asmeninis augalų žinynas',
        start_url: '/',
        display: 'standalone',
        background_color: '#1c3a2a',  // Brandbook v1.0 Forest INK — splash background
        theme_color: '#f1ebdd',        // Bone PAPER — naršyklės chrome (Android Chrome bar, iOS status)
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Cache app shell + static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // /api/* — server functions (OAuth callback'as ir t.t.) NIEKADA
        // neturi būti serv'inami iš cache'o. iOS PWA'e be šito service worker
        // intercept'indavo /api/auth/callback navigation'ą ir grąžindavo cached
        // index.html'ą be googleIdToken'o → login loop.
        navigateFallbackDenylist: [/^\/api\//],
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
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(www\.inaturalist\.org|static\.inaturalist\.org|inaturalist-open-data\.s3\.amazonaws\.com|upload\.wikimedia\.org|commons\.wikimedia\.org)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'plant-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
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
