#!/usr/bin/env zsh
# gitexecute.sh — safe commit pipeline: lint → build → audit → bump version → pull → commit → push
# Usage: ./gitexecute.sh "your commit message"

set -e  # exit immediately on any non-zero exit code

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

# ── 3. Production build (catches compile / import errors) ─────────────────────
echo "🔨  Running build..."
if ! npm run build; then
  echo "❌  Build failed. Fix errors before committing."
  exit 1
fi
echo "✅  Build passed."

# ── 4. Security audit (block on high/critical vulnerabilities) ────────────────
echo "🔒  Running security audit..."
# --audit-level high: exit non-zero only for high or critical severities
if ! npm audit --audit-level high; then
  echo "❌  Security audit found high/critical vulnerabilities. Run 'npm audit fix' first."
  exit 1
fi
echo "✅  Security audit passed."

# ── 5. Pull latest (rebase to keep history linear) ───────────────────────────
echo "⬇️   Pulling latest changes..."
# Stash any working-tree changes (e.g. package-lock.json from audit fix) so
# the rebase can proceed cleanly, then restore them afterwards.
git stash --include-untracked --quiet
git pull --rebase
git stash pop --quiet 2>/dev/null || true   # no-op if nothing was stashed

# ── 6. Auto-bump version in index.html (V_X.Y → V_X.Y+1) ────────────────────
echo "🔖  Bumping version in index.html..."

# Read the current version string, e.g. V_1.19
CURRENT=$(grep -oE 'V_[0-9]+\.[0-9]+' index.html | head -1)

if [[ -z "$CURRENT" ]]; then
  echo "⚠️   Could not find a V_X.Y version string in index.html — skipping bump."
else
  # Split into major and minor
  MAJOR=$(echo "$CURRENT" | grep -oE '[0-9]+\.[0-9]+' | cut -d. -f1)
  MINOR=$(echo "$CURRENT" | grep -oE '[0-9]+\.[0-9]+' | cut -d. -f2)
  NEW_MINOR=$(( MINOR + 1 ))
  NEW_VERSION="V_${MAJOR}.${NEW_MINOR}"

  # In-place replace (macOS sed requires '' for -i)
  sed -i '' "s/${CURRENT}/${NEW_VERSION}/g" index.html

  echo "✅  Version bumped: ${CURRENT} → ${NEW_VERSION}"
fi

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

echo "✓  All done."
