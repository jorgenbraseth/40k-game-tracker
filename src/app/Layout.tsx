import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { Sheet } from '@/components/Sheet'
import { useAuth } from '@/features/auth/AuthProvider'
import { clsx } from '@/lib/clsx'
import { supabase } from '@/lib/supabase'
import { OfflineBanner } from './OfflineBanner'
import { UpdatePrompt } from './UpdatePrompt'

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/game/lobby', label: 'New game' },
  { to: '/history', label: 'History' },
  { to: '/ladders', label: 'Ladders' },
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
  // Home already renders the same crest full-size as its own hero -- a second, small copy of it
  // up here would just be redundant, so the header drops its own logo there and lets the nav (or,
  // on mobile, the hamburger) sit alone against the right edge instead.
  const onHome = useLocation().pathname === '/home'

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <UpdatePrompt />
      {/*
        Split from the inner div rather than blurring this element directly: Capacitor's Android
        WebView (unlike a normal mobile browser) targets API 36, where the OS forces edge-to-edge
        layout and ignores the old status-bar-push-down flags entirely (see capacitor.config.ts's
        StatusBar config comment) -- so the safe-area padding below is load-bearing, not
        decorative, or this bar renders under the status bar. Keeping `backdrop-blur` off this
        sticky element and on the inner div instead sidesteps a known Chromium/WebView quirk where
        `position: sticky` and `backdrop-filter` on the same element can stop sticking. `bg-ink`
        here (not just on the inner div) is load-bearing too -- without it, that safe-area padding
        strip is transparent, so scrolled-past page content shows through behind the status bar.
      */}
      <header className="sticky top-0 z-40 bg-ink pt-[var(--safe-inset-top)]">
        <div
          className={clsx(
            'mx-auto flex max-w-3xl items-center border-b border-veil-strong bg-ink/95 px-4 py-3 backdrop-blur',
            onHome ? 'justify-end' : 'justify-between',
          )}
        >
          {!onHome && (
            <NavLink to="/home" aria-label="40K Tracker" className="flex items-center">
              <BrandLogo className="h-10 w-auto sm:h-12" />
            </NavLink>
          )}
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
                        isActive ? 'bg-veil-strong text-paper' : 'text-paper/60 hover:text-paper',
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
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-paper/70 hover:bg-veil-strong hover:text-paper sm:hidden"
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

      {/*
        pb includes the safe-area bottom inset (see index.css's --safe-inset-* -- on Android's
        edge-to-edge WebView (see the header comment above), the last scrolled-to content
        otherwise sits right behind the on-screen gesture/nav bar with no way to scroll it clear,
        since nothing reserves that extra space in the page's total scrollable height.
      */}
      <footer className="mx-auto w-full max-w-3xl border-t border-veil-strong px-4 pt-4 pb-[calc(1rem+var(--safe-inset-bottom))] text-center text-xs text-paper/40">
        Unofficial fan project. Not affiliated with, endorsed, sponsored, or specifically approved
        by Games Workshop Limited. Warhammer 40,000 is a trademark of Games Workshop Limited.{' '}
        <Link to="/privacy" className="underline hover:text-paper/60">
          Privacy
        </Link>
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
                    isActive ? 'bg-veil-strong text-paper' : 'text-paper/70 hover:bg-veil hover:text-paper',
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
              className="mt-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-paper/70 hover:bg-veil hover:text-paper"
            >
              Sign out
            </button>
          </nav>
        </Sheet>
      )}
    </div>
  )
}
