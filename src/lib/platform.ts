import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor-wrapped native app (Android/iOS); false on web. */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform()

/** The web app's public address, for links that leave this device (invite links, email redirects). */
export const PUBLIC_WEB_ORIGIN = 'https://www.40ktracker.com'

/**
 * Origin to build shareable/outbound links from. On web that's wherever the app is being served
 * (so previews and local dev keep linking to themselves). Inside the native app it's always
 * PUBLIC_WEB_ORIGIN: Capacitor serves the bundled build from `https://localhost` (see
 * capacitor.config.ts's `androidScheme`), which means nothing on anyone else's device.
 */
export const shareableOrigin = (): string => (isNativePlatform() ? PUBLIC_WEB_ORIGIN : window.location.origin)
