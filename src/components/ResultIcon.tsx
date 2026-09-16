import { clsx } from '@/lib/clsx'

export type GameResultKind = 'victory' | 'defeat' | 'draw' | 'abandoned'

/** Small heraldic badge for a game's outcome (laurel skull / cracked skull / crossed blades /
 * tattered flag) -- decorative alongside the text result label next to it, hence the empty alt. */
export function ResultIcon({
  result,
  size = 'sm',
  className,
}: {
  result: GameResultKind
  size?: 'sm' | 'lg'
  className?: string
}) {
  return (
    <img
      src={`/images/results/${result}-${size}.png`}
      alt=""
      className={clsx('inline-block w-auto flex-shrink-0', size === 'lg' ? 'h-10' : 'h-4', className)}
    />
  )
}
