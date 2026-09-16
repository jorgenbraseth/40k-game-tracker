import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Registered by hand from src/app/UpdatePrompt.tsx (via virtual:pwa-register/react) instead
      // of the plugin's own auto-injected script, so a new deploy can surface a dismissible
      // "update available" prompt rather than silently reloading someone out of a live game.
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '40K Tracker',
        short_name: '40K Tracker',
        description: 'Live score tracking for tabletop Warhammer 40,000 games.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0c10',
        theme_color: '#0b0c10',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precaches the build's own JS/CSS/HTML plus the small brand/icon/result assets --
        // deliberately excludes the deployment/layout reference image library (images/deployments,
        // images/layouts: ~30MB across 51 images), which is "browse when needed" content, not app
        // shell -- precaching all of it upfront would turn a first visit into a 30MB download over
        // exactly the flaky venue wifi this app is meant to cope with. Those still load and cache
        // normally via the browser's own HTTP cache on first view, same as without a service worker.
        // Also deliberately no runtimeCaching entries for Supabase, so REST calls and the Realtime
        // websocket are never intercepted by the service worker and always hit the network exactly
        // as without one (see issue #97: this is an installable app shell, not an offline-first
        // data layer).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        globIgnores: ['images/layouts/**', 'images/deployments/**'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
