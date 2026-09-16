import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Mobile-first bottom sheet, used for anything too fiddly for tap-to-increment. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        type="button"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-[#1a1b21] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-2 px-5 pt-5 pb-4">
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-paper">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 flex-shrink-0 rounded-full text-paper/60 hover:bg-white/10 hover:text-paper"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {/* Only the body scrolls -- content taller than the viewport (e.g. Game configuration's
            groupings/layout/attacker/turn-order stack) used to just overflow off the top with no
            way to reach it; the header now stays put so the close button is always reachable. */}
        <div className="overflow-x-hidden overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
