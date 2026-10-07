# Deployment

> CI/CD workflows, required secrets, Android builds and releases, and
> production hardening. Back to the [README](../README.md).

## Contents

- [Before the first deploy](#before-the-first-deploy)
- [Web: `deploy.yml`](#web-deployyml)
- [Android debug APK: `android-apk.yml`](#android-debug-apk-android-apkyml)
- [Migration compatibility check](#migration-compatibility-check)
- [Publishing a signed Android release](#publishing-a-signed-android-release)
- [Uploading to Google Play](#uploading-to-google-play)
- [Security headers](#security-headers)

---

## Before the first deploy

You need to create the actual Supabase project and the production Google
OAuth client by hand -- see "First thing to do" in
[`40k-tracker-plan.md`](../40k-tracker-plan.md). Everything else in this
repo is ready to run once those exist and the secrets below are set.

For Google sign-in, the OAuth client is wired up in the Supabase
dashboard (Auth → Providers → Google). For the Android app, the
`com.fortyktracker.app://auth/callback` deep link also has to be listed
as a Supabase Auth Redirect URL (see `src/lib/nativeAuth.ts`). Both are
done for the live project.

## Web: `deploy.yml`

Runs on every push to `main`:

1. typecheck, test, build
2. `supabase db push` against the linked project
3. `supabase functions deploy` (edge functions -- currently just
   `import-newrecruit-list`)
4. deploy `dist/` to Cloudflare Pages

Required repository secrets:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The service-role key is never used by the frontend, the repo, or this
workflow.

## Android debug APK: `android-apk.yml`

(Issue #125.) Separate from the deploy pipeline and never pushes
anywhere.

- Builds a debug `.apk` from the Capacitor Android project, using the
  same `VITE_SUPABASE_*` secrets as above, so the build talks to the real
  backend.
- Uploads it as a downloadable Actions artifact, so a sideloadable test
  build exists without touching `main`.
- Runs automatically on every PR (posting/updating a comment with the
  download link) and on demand for any branch via `workflow_dispatch`.

## Migration compatibility check

That APK is a frozen snapshot rather than a live view of
`www.40ktracker.com`, and a real store release will lag behind `main` by
however long a Play/App Store rollout takes. So `ci.yml` runs
`scripts/check-migration-compat.sh` on every PR to catch migrations that
would break an already-released native build.

See `CLAUDE.md`'s "Backend changes must stay compatible with released
native app builds" for the actual rule this is a tripwire for.

## Publishing a signed Android release

A real (signed) release, as opposed to the debug APK above, needs an
**upload keystore**:

- generated once, locally (`keytool -genkeypair ...` -- see
  `android/keystore.properties.example` for the exact command);
- **never committed** to this repo (`android/.gitignore` excludes it).

From there, two ways to produce the signed `.aab`:

### Option A: locally

1. Copy `android/keystore.properties.example` to
   `android/keystore.properties` and fill in the real path/passwords.
2. `npm run android:bundle` produces it at
   `android/app/build/outputs/bundle/release/`.

### Option B: `android-release.yml`

Manual `workflow_dispatch` only -- never runs on a merge to `main`,
unlike `deploy.yml`.

- **Inputs:** just `track` and `releaseStatus` (see
  [Uploading to Google Play](#uploading-to-google-play)). Pick
  `track: none` to only build the `.aab`. The code that gets built is
  whatever branch you pick under "Use workflow from". There's no version
  to choose -- both version values are automatic.
- **`versionName` is the UTC date** of the run, e.g. `2026.10.07`. It's
  what users see in the store and in Android's app info. It doesn't
  have to be unique: two releases on the same day share a name and are
  told apart by `versionCode`.
- **`versionCode` is computed automatically** from the current UTC time
  plus a trailing serial digit: `yyMMddHH` + the workflow's own
  `run_number mod 10` (e.g. `260922201`).
  - Play rejects a re-upload with a `versionCode` it's already seen; this
    way there's nothing to track or bump by hand between releases.
  - The serial digit means re-triggering a release within the same hour
    (a bad build, a mistake caught right after dispatch) still gets a
    usable, higher `versionCode` rather than colliding with the one
    before it.
  - `versionCode` is a 32-bit int capped by Play at 2,100,000,000, which
    is why it's this 9-digit shape: a full `yyyyMMddHHmmss` overflows
    outright, and even `yyMMddHHmm` overflows for any date after ~2021.
  - `android/app/build.gradle`'s `defaultConfig` reads both values from
    Gradle `-P` properties when the workflow passes them, falling back to
    `1`/`"1.0"` for local/debug builds that don't.
- **Trust trade-off:** the workflow needs the keystore's contents in this
  repo's Actions secrets instead of only on a developer's machine -- a
  real trade-off the workflow's own comments spell out, not a free
  upgrade.
- **Required secrets:**
  - `ANDROID_KEYSTORE_BASE64` -- the keystore file, base64-encoded (e.g.
    `base64 -i upload-keystore.jks`, or on Windows `certutil -encode` with
    the header/footer lines stripped)
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

### Either way

Without `keystore.properties` present at build time,
`assembleDebug`/`android-apk.yml` build exactly as before. Only
`bundleRelease`/`assembleRelease` need it, and they fail with a clear
message if it's missing rather than Gradle's own confusing one.

See issue #125 for the rest of the Play Store submission checklist
(developer account, store listing, privacy policy, content rating, Data
Safety form).

## Uploading to Google Play

`android-release.yml` can push the signed `.aab` straight to a Play
track (via
[`r0adkll/upload-google-play`](https://github.com/r0adkll/upload-google-play),
pinned to a commit) instead of you downloading the artifact and
uploading it in Play Console by hand. The `.aab` is always uploaded as
an Actions artifact too, whatever happens to the Play step.

### Workflow inputs

- **`track`** -- `none` (build only, no upload), `internal` (default),
  `alpha` (closed testing), `beta` (open testing), or `production`.
- **`releaseStatus`** -- `draft` (default) or `completed`.
  - `draft` creates the release in Play Console without rolling it out;
    you review and press "Start rollout" there. It's also the **only**
    status Play accepts while the app itself has never been published.
  - `completed` rolls it out to everyone on that track immediately.

Staged (percentage) rollouts and "What's new" release notes aren't
workflow inputs: upload as `draft` and set both in Play Console when you
roll the release out.

The release is named `<versionName> (<versionCode>)` in Play Console,
e.g. `2026.10.07 (261007153)`.

### One-time setup

None of this can be done from the repo -- it's all in Google's consoles.

1. **Create the app in Play Console** (package `com.fortyktracker.app`)
   and accept **Play App Signing**. The keystore in this repo's secrets
   is then only the *upload* key; Google holds the real app-signing key.
2. **Upload the first `.aab` by hand.** The Play Developer API can't
   create an app or make its first upload. Run the workflow with
   `track: none`, download the artifact, and upload it to the internal
   testing track in Play Console. After that, the workflow can do it.
3. **Create a Google Cloud service account:**
   - In a Google Cloud project, enable the **Google Play Android
     Developer API**.
   - Create a service account (no Cloud IAM roles needed) and create a
     **JSON key** for it.
4. **Grant it access in Play Console:** Users and permissions → Invite
   new users → the service account's email. Under *App permissions*,
   add this app with at least "Release apps to testing tracks" (plus
   "Release to production…" if you'll use `track: production`). It can
   take a while (sometimes up to a day) before the API accepts the new
   account.
5. **Add the secret** `PLAY_SERVICE_ACCOUNT_JSON` -- the full contents
   of that JSON key file -- alongside the keystore secrets (repository
   secrets or the `production` environment; the job runs in that
   environment so either works). Then delete the local copy of the key.

If the secret is missing, the workflow fails right after building with
a message pointing here; the `.aab` artifact is still there.

### Trust trade-off

Same shape as the keystore one above, but bigger: this secret can
publish to the store, not just sign a bundle. Keep its Play Console
permissions scoped to this one app and to the tracks you actually use,
and consider requiring reviewers on the `production` environment so
every run needs an explicit approval.

## Security headers

`public/_headers` sets a couple of baseline hardening headers Cloudflare
Pages applies to every response:

- `Strict-Transport-Security` -- the site is already HTTPS-only via
  Cloudflare's own redirect; this just makes that explicit to returning
  browsers.
- `X-Frame-Options: DENY` -- nothing here is meant to be embedded in
  someone else's iframe.

**No Content-Security-Policy yet.** Getting one right without breaking
the Google OAuth redirect, Supabase API/Storage calls, or avatar/layout
images needs its own careful pass.
