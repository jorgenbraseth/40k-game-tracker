import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNativePlatform } from './platform'
import { showToast } from './toast'
import { supabase } from './supabase'

/**
 * Google (and Apple) block OAuth sign-in from inside an app's own embedded WebView -- Capacitor's
 * included -- so the native build can't just point `redirectTo` at `/auth/callback` and let the
 * WebView follow it the way the web build does (see LandingPage.tsx). Instead:
 *   1. `signInWithOAuth` is called with `skipBrowserRedirect: true` and this app-scheme redirect,
 *      and the resulting URL is opened in the system browser (`openNativeOAuth`) instead.
 *   2. Google's own redirect back to this scheme is intercepted by the OS before it ever loads as
 *      a page, and handed to the app as an `appUrlOpen` event (`listenForNativeOAuthRedirect`).
 * This scheme has to also be registered as a Supabase Auth "Redirect URL" (same one-time
 * dashboard step the existing Google OAuth client setup already needs -- see docs/status.md) and matches
 * the intent-filter added to android/app/src/main/AndroidManifest.xml.
 */
export const NATIVE_OAUTH_REDIRECT = 'com.fortyktracker.app://auth/callback'

/** Hands an OAuth URL off to the system browser (Chrome Custom Tabs on Android) rather than
 * Capacitor's own WebView, which is what makes native Google sign-in acceptable to Google. */
export function openNativeOAuth(url: string): void {
  void Browser.open({ url })
}

/**
 * Registers the listener that picks a native OAuth sign-in back up once the system browser hands
 * control back to the app. Supabase's PKCE flow (see src/lib/supabase.ts) means the redirect only
 * carries a `code`, not a session -- exchanging it updates AuthProvider's session automatically
 * (same `onAuthStateChange` path the web build's `/auth/callback` relies on), so callers don't
 * need to navigate anywhere themselves once this resolves.
 *
 * No-op on web. Call once near app startup; returns a cleanup function.
 */
export function listenForNativeOAuthRedirect(): () => void {
  if (!isNativePlatform()) return () => {}

  const handlePromise = App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) return
    void Browser.close()

    const code = new URL(url).searchParams.get('code')
    if (!code) {
      showToast("Sign-in didn't go through. Please try again.")
      return
    }
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) showToast(error.message)
    })
  })

  return () => {
    void handlePromise.then((handle) => handle.remove())
  }
}
