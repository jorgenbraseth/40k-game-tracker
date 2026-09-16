import { useState } from 'react'
import { Button } from '@/components/Button'
import { isIOSBrowser, isStandalone, useInstallPrompt } from '@/lib/useInstallPrompt'

const DISMISSED_KEY = '40k-install-hint-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    // localStorage can be unavailable (private browsing, blocked storage) -- default to showing
    // the hint rather than never showing it, since a repeat isn't harmful there.
    return false
  }
}

/** A one-time, dismiss-forever nudge to install the app (see issue #97) -- not a repeating nag,
 * since this app is used mid-game with dice in hand and a banner reappearing every visit would
 * just be in the way. Android/Chrome gets a real "Install" button (via the captured
 * beforeinstallprompt event); iOS/Safari has no such API, so it gets static Share-sheet
 * instructions instead. Renders nothing once installed, on any other platform, or once dismissed
 * -- dismissal is a per-device UI preference, not app state, so it's plain localStorage rather
 * than anything synced or URL-addressable. */
export function InstallHint() {
  const { canPrompt, promptInstall } = useInstallPrompt()
  // Lazy initializers rather than an effect -- there's no SSR here, so reading localStorage/
  // matchMedia once up front (and never again, since neither needs to react to later changes)
  // avoids the extra render an effect-driven setState would cost.
  const [iOSHintEligible] = useState(() => isIOSBrowser() && !isStandalone())
  const [dismissed, setDismissed] = useState(readDismissed)

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to persist if storage is unavailable -- the hint just shows again next visit.
    }
  }

  if (dismissed || (!canPrompt && !iOSHintEligible)) return null

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-paper">Install 40K Tracker</p>
        <p className="mt-0.5 text-xs text-paper/60">
          {canPrompt
            ? 'Add it to your home screen for a full-screen, app-like experience during a game.'
            : 'Tap the Share icon, then "Add to Home Screen," for a full-screen, app-like experience during a game.'}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {canPrompt && (
          <Button
            variant="secondary"
            onClick={async () => {
              await promptInstall()
              dismiss()
            }}
          >
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex min-h-11 min-w-11 items-center justify-center text-lg text-paper/50 hover:text-paper"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
