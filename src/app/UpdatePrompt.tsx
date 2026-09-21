import { useRegisterSW } from 'virtual:pwa-register/react'
import { showToast } from '@/lib/toast'

/**
 * Surfaces a new deploy without ever reloading someone out from under an active game.
 * `registerType: 'prompt'` (vite.config.ts) means a new service worker sits waiting in the
 * background until this component calls `updateServiceWorker()` itself -- so the only way this
 * page ever reloads is the explicit tap below, never a silent background swap mid-round.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady: () => showToast('40K Tracker is ready to open without a connection.'),
    onRegisterError: (error) => console.error('Service worker registration failed', error),
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-gold px-4 py-2.5 text-sm font-medium text-ink"
      style={{ paddingBottom: 'calc(0.625rem + var(--safe-inset-bottom))' }}
    >
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="min-h-9 flex-shrink-0 rounded-lg bg-ink px-3 py-1.5 font-semibold text-gold"
      >
        Reload
      </button>
    </div>
  )
}
