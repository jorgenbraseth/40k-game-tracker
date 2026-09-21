import { KeepAwake } from '@capacitor-community/keep-awake'
import { useEffect, useRef } from 'react'
import { isNativePlatform } from './platform'

/**
 * Keeps the screen on while `active` is true (e.g. during a live game).
 *
 * The Wake Lock API this used to rely on exclusively is unreliable inside Capacitor's native
 * WebView (see issue #125/#97), so the native build instead uses `@capacitor-community/keep-awake`,
 * a thin wrapper around Android's `FLAG_KEEP_SCREEN_ON`. Web behavior is unchanged.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) return

    if (isNativePlatform()) {
      void KeepAwake.keepAwake()
      return () => {
        void KeepAwake.allowSleep()
      }
    }

    if (!('wakeLock' in navigator)) return

    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        lockRef.current = lock
      } catch {
        // Wake lock can be refused (low battery, backgrounded tab, etc).
        // Non-fatal: the app still works, the screen may just dim.
      }
    }

    void acquire()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) void acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void lockRef.current?.release()
      lockRef.current = null
    }
  }, [active])
}
