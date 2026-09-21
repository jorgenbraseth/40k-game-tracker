#!/usr/bin/env bash
# Flags new/changed Supabase migrations that could break an already-released native app build.
#
# Before issue #125, "backward-compatible migrations" meant surviving the few seconds deploy.yml
# takes between `supabase db push` and the Cloudflare Pages deploy going live -- the old frontend
# briefly runs against the new schema (see 40k-tracker-plan.md's "expand-then-contract" note).
# Once the Android/iOS apps exist, that window is no longer seconds: they bundle a frozen copy of
# the web app (see #125), so a schema change that's fine for a five-second gap can still break a
# native build that's weeks old and won't get a fix until its next store release. CLAUDE.md has
# the full rule this script enforces a tripwire for.
#
# This is a tripwire, not a compatibility proof -- it can't know whether a native release has
# actually shipped past whatever it's flagging. It greps new/changed migrations for shapes that
# usually mean an already-installed client's queries, generated types, or `supabase.rpc(...)`
# calls might now be wrong (dropped/renamed columns or tables, a narrowed column type, a new
# NOT NULL, a dropped function), and fails unless the migration explicitly says why that's safe.
# Deliberately excludes RLS policy changes (drop-then-recreate is the normal, harmless way to
# update a policy) and anything purely additive (a new table/column/function is invisible to an
# older client, not broken by it).
#
# Expect this to fire on most migrations that touch a `create function` -- this codebase's own
# convention is `drop function if exists foo(...); create function foo(...) ...` to change one,
# even when the name and signature end up unchanged. That's intentional: an RPC's name and
# parameters are exactly the client-facing contract a native build can't renegotiate mid-release,
# so every touch to one should get a conscious "did this change what a caller sends?" beat, not a
# free pass because the diff *looks* like a same-name replace.
set -euo pipefail

BASE_REF="${1:-origin/main}"

changed_migrations=$(git diff --name-only --diff-filter=AM "$BASE_REF"...HEAD -- supabase/migrations | grep '\.sql$' || true)

if [[ -z "$changed_migrations" ]]; then
  echo "No new/changed migrations in this PR."
  exit 0
fi

PATTERN='drop[[:space:]]+column|drop[[:space:]]+table|rename[[:space:]]+column|rename[[:space:]]+to|alter[[:space:]]+column[[:space:]]+[^[:space:]]+[[:space:]]+type|set[[:space:]]+not[[:space:]]+null|drop[[:space:]]+function'

failed=0
for file in $changed_migrations; do
  hits=$(grep -inE "$PATTERN" "$file" || true)
  if [[ -n "$hits" ]]; then
    if grep -q -- '-- breaking-change-ok:' "$file"; then
      echo "::notice file=$file::Acknowledged breaking-shaped change(s):"
      echo "$hits" | sed 's/^/    /'
    else
      echo "::error file=$file::Breaking-shaped schema change(s) with no acknowledgment:"
      echo "$hits" | sed 's/^/    /'
      failed=1
    fi
  fi
done

if [[ "$failed" -eq 1 ]]; then
  cat <<'EOF'

A migration above changes or removes something an already-released native app build might still
depend on -- see CLAUDE.md's "Backend changes must stay compatible with released native app
builds". If this is genuinely safe (nothing has shipped past this column/table/function yet, or
you've checked it against the minimum supported app version), add a comment anywhere in the
migration file explaining why:

    -- breaking-change-ok: <reason this is safe>

Otherwise, expand in this migration (add the new shape alongside the old) and contract in a
later one, once a native release has shipped past this change.
EOF
  exit 1
fi

echo "OK -- no unacknowledged breaking-shaped migration changes."
