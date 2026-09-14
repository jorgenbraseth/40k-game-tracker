import { useEffect, useRef } from 'react'

/** Keeps the screen on while `active` is true (e.g. during a live game). */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

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
