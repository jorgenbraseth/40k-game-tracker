import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { clsx } from '@/lib/clsx'
import { supabase } from '@/lib/supabase'
import { OfflineBanner } from './OfflineBanner'

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/history', label: 'History' },
  { to: '/stats', label: 'Stats' },
  { to: '/profile', label: 'Profile' },
]

export function Layout() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <NavLink to="/home" className="text-lg font-bold tracking-wide text-gold">
            40K Tracker
          </NavLink>
          {user && (
            <nav className="flex items-center gap-1">
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
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-paper/40">
        Unofficial fan project. Not affiliated with, endorsed, sponsored, or specifically approved
        by Games Workshop Limited. Warhammer 40,000 is a trademark of Games Workshop Limited.
      </footer>
    </div>
  )
}
