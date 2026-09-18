import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { InstallHint } from '@/components/InstallHint'

const SHORTCUTS = [
  { to: '/game/lobby', label: 'New game', description: 'Start, join, or log a game' },
  { to: '/history', label: 'History', description: 'Every finished game, yours and others’' },
  { to: '/ladders', label: 'Ladders', description: 'Standings and Elo/Glicko-2 rankings' },
  { to: '/tournaments', label: 'Tournaments', description: 'Bracket-style events' },
  { to: '/stats', label: 'Stats', description: 'Your record, factions, and trends' },
  { to: '/profile', label: 'Profile', description: 'Name, avatar, theme, and logo' },
]

/**
 * The landing page for a signed-in visitor -- previously this was the "start/join a game" hub
 * (now its own "New game" nav item, GameLobbyPage), so returning here didn't always mean "I want
 * to play right now." This is a proper front door instead: the app's own crest, prominent, and a
 * shortcut to every section, same shape as the shortcuts a "New game" card in the grid links to.
 */
export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center pt-2 text-center">
        <BrandLogo className="h-44 w-auto drop-shadow-xl drop-shadow-gold/30 sm:h-56" />
        <p className="mt-3 text-paper/60">Live score tracking for tabletop Warhammer 40,000.</p>
      </div>

      <InstallHint />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.to}
            to={shortcut.to}
            className="flex flex-col gap-1 rounded-xl border border-veil-strong bg-veil p-4 hover:bg-veil-strong"
          >
            <span className="font-medium text-paper">{shortcut.label}</span>
            <span className="text-xs text-paper/50">{shortcut.description}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
