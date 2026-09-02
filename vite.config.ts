import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // autoUpdate: a deploy replaces the cached shell on next load, so nobody
    // is stuck on an old bundle talking to a newer Firestore schema.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Streepkeslijst',
        short_name: 'Streepkes',
        lang: 'nl',
        display: 'standalone',
        start_url: '/',
        theme_color: '#121310',
        background_color: '#121310',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    // de rules-test heeft de Firestore-emulator nodig: npm run test:rules
    exclude: ['**/node_modules/**', '**/*.rules.test.ts'],
  },
})
