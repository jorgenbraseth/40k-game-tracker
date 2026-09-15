import { clsx } from '@/lib/clsx'

export interface ImageOption {
  id: string
  label: string
  imagePath: string | null
}

/** A tappable grid of image + label cards -- used wherever a player picks between a handful of
 * illustrated options (deployment map, terrain layout) instead of a plain text dropdown. */
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
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-paper/80">{label}</span>
      <div className={clsx('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {options.map((option) => {
          const selected = option.id === value
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'flex flex-col overflow-hidden rounded-lg border text-left active:scale-95',
                selected ? 'border-gold bg-gold/10' : 'border-white/15 bg-white/5',
              )}
            >
              {option.imagePath ? (
                <img src={option.imagePath} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-white/5 text-xs text-paper/30">
                  No image
                </div>
              )}
              <span
                className={clsx(
                  'px-2 py-1.5 text-xs leading-tight font-medium',
                  selected ? 'text-gold' : 'text-paper/70',
                )}
              >
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
