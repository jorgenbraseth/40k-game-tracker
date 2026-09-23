# Deployment

> CI/CD workflows, required secrets, Android builds and releases, and
> production hardening. Back to the [README](../README.md).

## Contents

- [Before the first deploy](#before-the-first-deploy)
- [Web: `deploy.yml`](#web-deployyml)
- [Android debug APK: `android-apk.yml`](#android-debug-apk-android-apkyml)
- [Migration compatibility check](#migration-compatibility-check)
- [Publishing a signed Android release](#publishing-a-signed-android-release)
- [Security headers](#security-headers)

---

## Before the first deploy

You need to create the actual Supabase project and the production Google
OAuth client by hand -- see "First thing to do" in
[`40k-tracker-plan.md`](../40k-tracker-plan.md). Everything else in this
repo is ready to run once those exist and the secrets below are set.

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

- **Inputs:** only `versionName`.
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
