import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'RetailPro — Inventory & POS',
        short_name: 'RetailPro',
        description: 'Inventory management and point of sale for Pakistani retail shops',
        theme_color: '#22c55e',
        background_color: '#101828',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Product and customer lookups are read-heavy and tolerate slight
            // staleness, so serve from cache first and refresh in the background.
            // This is what keeps the POS usable when the shop's internet drops.
            urlPattern: /\/api\/(products|categories|customers|suppliers)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'retailpro-catalog',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Reports must never show stale numbers, so hit the network first
            // and only fall back to cache if the request fails outright.
            urlPattern: /\/api\/reports/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'retailpro-reports',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
