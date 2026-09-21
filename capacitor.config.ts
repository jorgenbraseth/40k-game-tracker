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
      //
      // backgroundColor/overlaysWebView only do anything below Android 15 (API 35) -- Android
      // forces edge-to-edge (ignoring these) once minSdkVersion's app targets API 35 with no
      // opt-out, and unconditionally from API 36 on (this app's compileSdk/targetSdk, per
      // android/variables.gradle), so the WebView draws under the status bar regardless of these
      // two values on any device actually running what this app targets. `style` still works
      // everywhere (separate mechanism, status bar icon contrast only). The real, version-safe
      // fix for content clearing the status bar is CSS: Layout.tsx's header pads itself by
      // `env(safe-area-inset-top)`, which is 0 wherever the OS already reserves that space (older
      // API levels, where these two values still apply) and the actual inset everywhere else.
      style: 'DARK',
      backgroundColor: '#0b0c10',
      overlaysWebView: false,
    },
  },
}

export default config
