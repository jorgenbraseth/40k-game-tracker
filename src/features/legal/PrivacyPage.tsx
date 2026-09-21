import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'

const REPO_URL = 'https://github.com/jorgenbraseth/40k-game-tracker'
const LAST_UPDATED = 'September 21, 2026'

/**
 * Public, unauthenticated route (see router.tsx -- outside ProtectedRoute, same as LandingPage)
 * since this has to be reachable by anyone without signing in: Google Play/App Store review, and
 * anyone deciding whether to sign up in the first place. Content is a factual description of what
 * this app actually does with data, grounded in the real schema/code (auth.ts, ProfilePage,
 * game_players columns, the one edge function, etc.) -- update it here first if any of that
 * changes, not the other way around.
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link to="/" aria-label="40K Tracker" className="flex items-center">
          <BrandLogo className="h-10 w-auto" />
        </Link>
        <Link to="/" className="text-sm text-gold underline">
          Back to app
        </Link>
      </div>

      <div className="flex flex-col gap-6 text-paper/80">
        <div>
          <h1 className="text-2xl font-semibold text-paper">Privacy Policy</h1>
          <p className="mt-1 text-sm text-paper/50">Last updated {LAST_UPDATED}</p>
        </div>

        <p>
          40K Tracker is an unofficial, independently run fan project for tracking games of
          Warhammer 40,000 -- not affiliated with, endorsed, sponsored, or specifically approved by
          Games Workshop Limited. This policy covers the web app at{' '}
          <a href="https://www.40ktracker.com" className="text-gold underline">
            www.40ktracker.com
          </a>{' '}
          and the Android/iOS apps that wrap it, since they're the same account, the same data, and
          the same backend.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">What's collected</h2>
          <p>
            <strong className="text-paper">Account info.</strong> Signing up with email/password
            collects your email and password. Signing up with Google collects your email, name, and
            profile picture from your Google account (used to pre-fill your display name and
            avatar) -- nothing else from Google, and your Google password is never seen by this app.
          </p>
          <p>
            <strong className="text-paper">Profile info you choose to add.</strong> A display name
            (required at signup, editable any time -- never your email), and optionally a profile
            photo, a theme, and a crest, all purely cosmetic and entirely up to you.
          </p>
          <p>
            <strong className="text-paper">Game data.</strong> Whatever you or an opponent enter
            while using the app: factions, army names, an optional army-list link, round-by-round
            scores and objectives, and which ladders or tournaments a game is tagged to.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Who can see it</h2>
          <p>
            Your display name and avatar are visible to anyone you play against, and to other
            members of any ladder you're in. Your email address is never shown to other players --
            it's only ever used for signing in.
          </p>
          <p>
            By design, a <strong className="text-paper">finished</strong> game (faction, army
            names, final score) and a player's own stats page are visible to any signed-in user of
            the app, not just people you've actually played -- the same way History and ladder
            standings work for everyone else's games too. A game still being set up or played is
            only visible to its own participants.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Who it's shared with</h2>
          <p>
            <a href="https://supabase.com" className="text-gold underline">
              Supabase
            </a>{' '}
            hosts this app's account system, database, file storage (profile photos), and realtime
            sync -- it's the only backend this app has, and the only third party with access to
            your data, acting solely on this app's instructions to run the service. There is no
            advertising, no analytics or tracking beyond that, and your data is never sold.
          </p>
          <p>
            The one exception: if you paste a NewRecruit army-list link to auto-fill your faction,
            that link (nothing else -- no account info) is sent to newrecruit.eu's own public page
            to read the faction name back off it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Deleting your data</h2>
          <p>
            There's no self-serve "delete my account" button in the app yet. Until there is, open
            an issue on{' '}
            <a href={`${REPO_URL}/issues`} className="text-gold underline">
              the GitHub repo
            </a>{' '}
            asking for your account to be deleted, and it'll be removed by hand -- profile, games,
            and all.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Children</h2>
          <p>
            This app isn't directed at children under 13, and it doesn't knowingly collect data
            from anyone that age.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Changes to this policy</h2>
          <p>
            If what this app collects or does with it changes, this page will be updated to match --
            same as the rest of the app's own documentation.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-paper">Contact</h2>
          <p>
            Questions about this policy, or about your data, are welcome as{' '}
            <a href={`${REPO_URL}/issues`} className="text-gold underline">
              an issue on the GitHub repo
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
