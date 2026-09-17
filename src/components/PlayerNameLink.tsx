import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'

/**
 * A player's display name, linked to their stats page (`/players/:userId`) whenever there's a
 * stable identity to link to -- their own account, or, for an unclaimed seat a bookkeeper is
 * entering on someone's behalf, whoever they attributed it to. Plain, unlinked text when there
 * isn't one yet (nobody's joined or been attributed).
 *
 * `avatarUrl` is optional and omitted entirely by most existing call sites (issue #73) -- passing
 * it renders a small `Avatar` inline before the name; leaving it out renders exactly as before,
 * so every caller not yet updated to fetch/thread it through keeps working unchanged.
 *
 * Stops click propagation so this still works nested inside a row that's its own click target
 * (e.g. a game list row that otherwise navigates to that game's summary on click).
 */
export function PlayerNameLink({
  userId,
  name,
  avatarUrl,
  className,
}: {
  userId: string | null
  name: string
  avatarUrl?: string | null
  className?: string
}) {
  const content = avatarUrl !== undefined ? (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Avatar url={avatarUrl} name={name} size="h-5 w-5" />
      {name}
    </span>
  ) : (
    name
  )

  if (!userId) return <span className={className}>{content}</span>
  return (
    <Link
      to={`/players/${userId}`}
      onClick={(e) => e.stopPropagation()}
      className={className ? `${className} hover:underline` : 'hover:underline'}
    >
      {content}
    </Link>
  )
}
