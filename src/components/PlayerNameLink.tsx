import { Link } from 'react-router-dom'

/**
 * A player's display name, linked to their stats page (`/players/:userId`) whenever there's a
 * stable identity to link to -- their own account, or, for an unclaimed seat a bookkeeper is
 * entering on someone's behalf, whoever they attributed it to. Plain, unlinked text when there
 * isn't one yet (nobody's joined or been attributed).
 *
 * Stops click propagation so this still works nested inside a row that's its own click target
 * (e.g. a game list row that otherwise navigates to that game's summary on click).
 */
export function PlayerNameLink({
  userId,
  name,
  className,
}: {
  userId: string | null
  name: string
  className?: string
}) {
  if (!userId) return <span className={className}>{name}</span>
  return (
    <Link
      to={`/players/${userId}`}
      onClick={(e) => e.stopPropagation()}
      className={className ? `${className} hover:underline` : 'hover:underline'}
    >
      {name}
    </Link>
  )
}
