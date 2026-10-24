#!/usr/bin/env bash
# gitexecute.sh — safe commit pipeline: lint → pull → bump version (.env) → build → audit → commit → push
# Usage: ./gitexecute.sh "your commit message"

set -e  # exit immediately on any non-zero exit code

# Always run from the project root, regardless of where the script is invoked from.
cd "$(dirname "$0")"

# ── 1. Require a commit message ───────────────────────────────────────────────
if [[ -z "$1" ]]; then
  echo "❌  Error: commit message is required."
  echo "    Usage: ./gitexecute.sh \"your commit message\""
  exit 1
fi

COMMIT_MSG="$1"

# ── 2. Lint (security + bad-code checks) ─────────────────────────────────────
echo "🔍  Running lint..."
if ! npm run lint; then
  echo "❌  Lint failed. Fix errors before committing."
  exit 1
fi
echo "✅  Lint passed."

# ── 3. Pull latest (rebase to keep history linear) ───────────────────────────
echo "⬇️   Pulling latest changes..."
# Stash any working-tree changes so the rebase can proceed cleanly, then restore them afterwards.
git stash --include-untracked --quiet
if ! git pull --rebase; then
  echo "❌  git pull --rebase failed. Please resolve merge conflicts."
  git stash pop --quiet 2>/dev/null || true
  exit 1
fi
git stash pop --quiet 2>/dev/null || true   # no-op if nothing was stashed

# ── 4. Auto-bump version in .env and public/sw.js ────────────────────────────
echo "🔖  Bumping version in .env..."

if [ ! -f .env ]; then
  echo "VITE_APP_VERSION=1.22" > .env
fi

CURRENT=$(grep -E '^VITE_APP_VERSION=' .env | cut -d= -f2 | tr -d '\r\n')

if [[ -z "$CURRENT" ]]; then
  CURRENT="1.22"
  NEW_VERSION="1.23"
else
  MAJOR=$(echo "$CURRENT" | cut -d. -f1)
  MINOR=$(echo "$CURRENT" | cut -d. -f2)
  NEW_MINOR=$(( MINOR + 1 ))
  NEW_VERSION="${MAJOR}.${NEW_MINOR}"
fi

# Update .env (compatible with both macOS BSD sed and Linux GNU sed)
sed -i.bak -E "s/^VITE_APP_VERSION=.*/VITE_APP_VERSION=${NEW_VERSION}/" .env && rm -f .env.bak
echo "✅  Version bumped in .env: ${CURRENT} → ${NEW_VERSION}"

# Update service worker cache name in public/sw.js to prevent browser caching
if [ -f "public/sw.js" ]; then
  sed -i.bak -E "s/const CACHE_NAME = ['\"][^'\"]*['\"];/const CACHE_NAME = 'neon-drone-cache-v${NEW_VERSION}';/" public/sw.js && rm -f public/sw.js.bak
  echo "✅  Service worker cache updated in public/sw.js: neon-drone-cache-v${NEW_VERSION}"
fi

# ── 5. Production build (catches compile / import errors with new version) ─────
echo "🔨  Running build..."
if ! npm run build; then
  echo "❌  Build failed. Fix errors before committing."
  exit 1
fi
echo "✅  Build passed."

# ── 6. Security audit (block on high/critical vulnerabilities) ────────────────
echo "🔒  Running security audit..."
# --audit-level high: exit non-zero only for high or critical severities
if ! npm audit --audit-level high; then
  echo "❌  Security audit found high/critical vulnerabilities. Run 'npm audit fix' first."
  exit 1
fi
echo "✅  Security audit passed."

# ── 7. Stage everything ───────────────────────────────────────────────────────
echo "📦  Staging all changes..."
git add -A

# Bail out gracefully if there is nothing to commit
if git diff --cached --quiet; then
  echo "ℹ️   Nothing to commit — working tree is clean."
  exit 0
fi

# ── 8. Commit ─────────────────────────────────────────────────────────────────
echo "💾  Committing: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# ── 9. Push ───────────────────────────────────────────────────────────────────
echo "🚀  Pushing to remote..."
git push

echo "✓  All done! Version V_${NEW_VERSION} successfully committed and pushed."
