import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Build ID (timestamp per `vite build`) — response cache deploy-versijos
  // invalidacijai: naujas deploy → AI search cache išsivalo, kad vartotojai
  // negautų pre-fix rezultatų po prompt/logikos pakeitimo.
  define: {
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  plugins: [
    react(),
    VitePWA({
      // 2026-06-03 — 'prompt' (buvo 'autoUpdate'). autoUpdate + skipWaiting tyliai
      // perimdavo SW + reload'indavo puslapį KAS deploy → su dažnais deploy'ais =
      // „nuolat persikrauna" pojūtis + prarasta UI būsena viduryje darbo. 'prompt' →
      // naujas SW LAUKIA, parodom „Atnaujinti" toast'ą (UpdatePrompt.jsx), user valdo kada.
      registerType: 'prompt',
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
        // 2026-06-08 — vision.html + screenshots NEprecache'inami: kitaip SW serv'intų
        // juos iš cache APLENKDAMAS Basic Auth middleware (slaptažodžio apėjimas).
        // Taip jie visada eina per tinklą → Vercel → gate'as.
        globIgnores: ['vision.html', 'screenshots/**'],
        // navigateFallback NEtaiko /api/*, /vision*, /screenshots/* — kitaip SW
        // serv'intų cached app shell'į (index.html → dashboard) šioms navigacijoms
        // ir užklausa nepasiektų Vercel (rewrite į vision.html + Basic Auth middleware).
        // 2026-06-08 — pridėta /vision + /screenshots (vizijos doc'as buvo „šešėliuojamas").
        navigateFallbackDenylist: [/^\/api\//, /^\/vision/, /^\/screenshots\//],
        // 2026-06-03 — firestore.googleapis.com SĄMONINGAI NEcache'inamas.
        // Firestore Listen (onSnapshot) streaming kanalo apvyniojimas Workbox'u
        // (buvo NetworkFirst, 5s timeout) korumpuoja SDK listener target state
        // → b815 „Unexpected state" crash flood + laužo live snapshot'us (stale
        // listener bug, dėl kurio buvo išjungta IndexedDB persistence). Žinomas
        // anti-pattern: Listen kanalas niekada per SW cache. Tik Storage + image API.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage',
              // 2026-06-01: padidinta 200→500, lifetime 30→60d — catalog turi
              // 88 entries × 2 variants (hero PNG + thumb WebP) = 176 entries
              // TIK iš catalog'o. Plus user plant photos, candidate thumbnails
              // per search'us. 200 buvo arti limit'o → LRU eviction → re-fetch'ai.
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
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
