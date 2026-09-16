import { useState } from 'react'
import { FullscreenImageViewer } from '@/components/FullscreenImageViewer'
import { clsx } from '@/lib/clsx'

export interface ImageOption {
  id: string
  label: string
  imagePath: string | null
}

/** A tappable grid of image + label cards -- used wherever a player picks between a handful of
 * illustrated options (deployment map, terrain layout) instead of a plain text dropdown. Each
 * thumbnail is small by design (a few per row), so a corner expand button opens it fullscreen --
 * these images are a physical-setup reference, not just a picker, and small is too hard to read
 * details off of across a table. Cards are `role="button"` divs rather than real `<button>`s so
 * that corner button can be a proper nested `<button>` (a `<button>` inside a `<button>` is
 * invalid HTML). */
export function ImageOptionGrid({
  label,
  options,
  value,
  onChange,
  columns = 3,
}: {
  label: string
  options: ImageOption[]
  value: string
  onChange: (id: string) => void
  columns?: 2 | 3
}) {
  const [expanded, setExpanded] = useState<ImageOption | null>(null)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-paper/80">{label}</span>
      <div className={clsx('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {options.map((option) => {
          const selected = option.id === value
          return (
            <div
              key={option.id}
              role="button"
              tabIndex={0}
              onClick={() => onChange(option.id)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                onChange(option.id)
              }}
              className={clsx(
                'flex cursor-pointer flex-col overflow-hidden rounded-lg border text-left active:scale-95',
                selected ? 'border-gold bg-gold/10' : 'border-white/15 bg-white/5',
              )}
            >
              <div className="relative">
                {option.imagePath ? (
                  <img
                    src={option.imagePath}
                    alt=""
                    loading="lazy"
                    className="aspect-[44/60] w-full bg-white/5 object-contain"
                  />
                ) : (
                  <div className="flex aspect-[44/60] w-full items-center justify-center bg-white/5 text-xs text-paper/30">
                    No image
                  </div>
                )}
                {option.imagePath && (
                  <button
                    type="button"
                    aria-label={`View ${option.label} fullscreen`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(option)
                    }}
                    className="absolute right-1 bottom-1 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/60 text-base leading-none text-paper hover:bg-black/80"
                  >
                    ⤢
                  </button>
                )}
              </div>
              <span
                className={clsx(
                  'px-2 py-1.5 text-xs leading-tight font-medium',
                  selected ? 'text-gold' : 'text-paper/70',
                )}
              >
                {option.label}
              </span>
            </div>
          )
        })}
      </div>

      {expanded?.imagePath && (
        <FullscreenImageViewer
          src={expanded.imagePath}
          alt={expanded.label}
          label={expanded.label}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  )
}
