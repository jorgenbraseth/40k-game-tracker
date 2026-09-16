import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWakeLock } from '@/lib/useWakeLock'

/** Fullscreen reference view for a picker's image -- e.g. a terrain layout, so it's readable
 * across the table while physically setting up the board. Keeps the screen awake for as long as
 * it's open (released on close), since board setup takes a while and phones otherwise lock mid-way
 * through. Native pinch-zoom still works (the app's viewport meta never disables it), so this
 * doesn't need its own zoom/pan handling. */
export function FullscreenImageViewer({
  src,
  alt,
  label,
  onClose,
}: {
  src: string
  alt: string
  label?: string
  onClose: () => void
}) {
  useWakeLock(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label ?? alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      {label && (
        <p className="pointer-events-none absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-paper">
          {label}
        </p>
      )}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/60 text-xl text-paper hover:bg-black/80"
      >
        ✕
      </button>
    </div>,
    document.body,
  )
}
