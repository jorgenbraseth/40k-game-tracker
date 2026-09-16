import { useEffect, useState } from 'react'

/** Only fired by Chromium browsers (Android Chrome, desktop Chrome/Edge) -- Safari has no
 * equivalent event, see InstallHint's own iOS branch. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS's own non-standard flag -- matchMedia('(display-mode: standalone)') doesn't reliably
    // reflect an iOS home-screen launch the way it does on Android/desktop.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

/** Captures Chromium's `beforeinstallprompt` so InstallHint can trigger it from its own button
 * instead of the browser's default mini-infobar -- the event fires once, early, and is gone if
 * not stashed. Null on iOS/Safari (no such event exists there) and once already installed. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') setEvent(null)
  }

  return { canPrompt: Boolean(event), promptInstall }
}

/** iOS Safari has no `beforeinstallprompt` -- this is the only way to detect "not installed, and
 * on a platform where the only path is the manual Share -> Add to Home Screen flow." */
export function isIOSBrowser() {
  const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isSafariLike = !/crios|fxios|edgios/i.test(navigator.userAgent)
  return isIOSDevice && isSafariLike && !isStandalone()
}

export { isStandalone }
