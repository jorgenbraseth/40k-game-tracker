import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { clsx } from '@/lib/clsx'
import { useLongPress } from '@/lib/useLongPress'

interface ScoreCellProps {
  label: string
  value: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (next: number) => void
}

/**
 * Tap to increment by `step`. Long-press (or the − button) opens a sheet
 * for direct entry / decrementing -- sized for a thumb, usable one-handed.
 */
export function ScoreCell({ label, value, max, step = 1, disabled, onChange }: ScoreCellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const clamp = (n: number) => Math.min(max, Math.max(0, n))

  const longPress = useLongPress(
    () => !disabled && onChange(clamp(value + step)),
    () => {
      if (disabled) return
      setDraft(String(value))
      setSheetOpen(true)
    },
  )

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium tracking-wide text-paper/60 uppercase">{label}</span>
        <button
          type="button"
          disabled={disabled}
          className={clsx(
            'flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-gold/40 bg-gold/10 text-3xl font-bold text-gold tap-highlight-transparent select-none active:scale-95 disabled:opacity-50',
          )}
          {...longPress}
        >
          {value}
        </button>
        <span className="text-[11px] text-paper/40">of {max} · tap +{step}, hold to edit</span>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Edit ${label}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setDraft((d) => String(clamp(Number(d) - 1)))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-paper active:scale-95"
              aria-label="Decrement"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={max}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-24 rounded-lg border border-white/15 bg-white/5 py-2 text-center text-2xl text-paper focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setDraft((d) => String(clamp(Number(d) + 1)))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-paper active:scale-95"
              aria-label="Increment"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(clamp(Number(draft) || 0))
              setSheetOpen(false)
            }}
            className="min-h-11 rounded-lg bg-blood px-4 py-2.5 font-medium text-paper active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      </Sheet>
    </>
  )
}
