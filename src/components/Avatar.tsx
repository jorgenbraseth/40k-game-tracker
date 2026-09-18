import { clsx } from '@/lib/clsx'

/** A small circular avatar, falling back to the player's own initial on a neutral background when
 * there's no `url` -- most players, since this is opt-in (issue #73), not every account's own
 * Google-provided image. `size` is a literal Tailwind size pair so every call site stays a real,
 * static class the build can see, not an interpolated one Tailwind wouldn't pick up. */
export function Avatar({
  url,
  name,
  size = 'h-8 w-8',
  className,
}: {
  url: string | null | undefined
  name: string
  size?: string
  className?: string
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={clsx(size, 'flex-shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      className={clsx(
        size,
        'flex flex-shrink-0 items-center justify-center rounded-full bg-veil-strong text-[0.6rem] font-semibold text-paper/60',
        className,
      )}
    >
      {initial}
    </span>
  )
}
