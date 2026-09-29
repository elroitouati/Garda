import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// ב-GitHub Pages האתר יושב תחת /Garda/
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'hero.jpg'],
      manifest: {
        name: 'טואטי בגארדה',
        short_name: 'טואטי בגארדה',
        description: 'הטיול המשפחתי לאגם גארדה · 27.9–4.10.2026',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // אנדרואיד: "שיתוף" מגוגל מפות ישר לאפליקציה קובע נקודת מפגש
        share_target: { action: base, method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        background_color: '#FAF5EA',
        theme_color: '#1768B0',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // תמונות פרופיל: הנתיב ייחודי לכל העלאה, אז אפשר להתעלם מהטוקן החתום
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/sign/avatars/'),
            handler: 'CacheFirst',
            options: { cacheName: 'avatars', matchOptions: { ignoreSearch: true }, expiration: { maxEntries: 100 } },
          },
        ],
      },
    }),
  ],
})
