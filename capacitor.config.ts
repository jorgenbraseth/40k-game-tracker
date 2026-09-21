import type { CapacitorConfig } from '@capacitor/cli'

// Wraps the same `dist/` build the web app already deploys to Cloudflare Pages -- see issue #125.
// `npx cap sync` copies whatever's currently in `dist/` into the native `android/` project; there's
// no separate mobile build, `npm run build` is still the only build step.
const config: CapacitorConfig = {
  appId: 'com.fortyktracker.app',
  appName: '40K Tracker',
  webDir: 'dist',
  // https (not Capacitor's default file://) so the app's own fetch/XHR/cookie behavior toward
  // Supabase matches the web version as closely as possible, and so a same-scheme custom URL
  // scheme (see src/lib/nativeAuth.ts) reads as a plausible redirect target during OAuth.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      // Matches the PWA manifest's theme_color/background_color (vite.config.ts) so the status
      // bar reads as part of the app chrome rather than a mismatched native default.
      style: 'DARK',
      backgroundColor: '#0b0c10',
      overlaysWebView: false,
    },
  },
}

export default config
