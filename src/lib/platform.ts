import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor-wrapped native app (Android/iOS); false on web. */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform()
