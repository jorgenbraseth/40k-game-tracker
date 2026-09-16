import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Sheet } from '@/components/Sheet'
import { useAuth } from '@/features/auth/AuthProvider'
import { clsx } from '@/lib/clsx'
import { supabase } from '@/lib/supabase'
import { OfflineBanner } from './OfflineBanner'
import { UpdatePrompt } from './UpdatePrompt'

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/history', label: 'History' },
  { to: '/ladders', label: 'Ladders' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/stats', label: 'Stats' },
  { to: '/profile', label: 'Profile' },
]

/**
 * The 6 nav links + Sign out don't fit in one row at phone width without forcing a horizontal
 * zoom-out -- shown inline from `sm:` up, collapsed behind a hamburger button (opening the same
 * `Sheet` used for every other picker in this app) below it.
 */
export function Layout() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <UpdatePrompt />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <NavLink to="/home" aria-label="40K Tracker" className="flex items-center">
            <img src="/images/brand/logo.webp" alt="40K Tracker" width={283} height={220} className="h-10 w-auto sm:h-12" />
          </NavLink>
          {user && (
            <>
              <nav className="hidden items-center gap-1 sm:flex">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        'rounded-lg px-2.5 py-2 text-sm font-medium',
                        isActive ? 'bg-white/10 text-paper' : 'text-paper/60 hover:text-paper',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="ml-1 rounded-lg px-2.5 py-2 text-sm font-medium text-paper/60 hover:text-paper"
                >
                  Sign out
                </button>
              </nav>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-paper/70 hover:bg-white/10 hover:text-paper sm:hidden"
              >
                ☰
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-3xl border-t border-white/10 px-4 py-4 text-center text-xs text-paper/40">
        Unofficial fan project. Not affiliated with, endorsed, sponsored, or specifically approved
        by Games Workshop Limited. Warhammer 40,000 is a trademark of Games Workshop Limited.
      </footer>

      {user && (
        <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-white/10 text-paper' : 'text-paper/70 hover:bg-white/5 hover:text-paper',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                supabase.auth.signOut()
              }}
              className="mt-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-paper/70 hover:bg-white/5 hover:text-paper"
            >
              Sign out
            </button>
          </nav>
        </Sheet>
      )}
    </div>
  )
}
