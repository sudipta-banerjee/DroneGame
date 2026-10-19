#!/usr/bin/env bash
#
# run-mac.sh — bootstrap and run the Neon Drone project locally on macOS.
#
# What it does:
#   1. Verifies Node.js and npm are installed and meet Vite 8's requirements.
#   2. Installs npm dependencies if node_modules is missing (or stale).
#   3. Starts the Vite dev server.
#
# Usage:
#   ./run-mac.sh            # install deps (if needed) and start dev server
#   ./run-mac.sh --build    # build the production bundle to dist/
#   ./run-mac.sh --preview  # preview the production build locally
#
# Requirements (handled automatically below):
#   - Node.js >= 20.19  OR  >= 22.12  OR  >= 24   (Vite 8 requirement)
#   - npm (ships with Node)
#

set -euo pipefail

# Always run from the project root, regardless of where the script is invoked from.
cd "$(dirname "$0")"

# --- Pretty printing -----------------------------------------------------------
BOLD=$(tput bold 2>/dev/null || echo "")
CYAN=$(tput setaf 6 2>/dev/null || echo "")
GREEN=$(tput setaf 2 2>/dev/null || echo "")
RED=$(tput setaf 1 2>/dev/null || echo "")
YELLOW=$(tput setaf 3 2>/dev/null || echo "")
RESET=$(tput sgr0 2>/dev/null || echo "")

info()  { printf "${CYAN}›${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$*"; }
err()   { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

# --- Preflight: Node & npm -----------------------------------------------------
info "Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then
    err "Node.js is not installed."
    printf "  Install it via Homebrew:\n"
    printf "    brew install node\n"
    printf "  Or use nvm (recommended for version control):\n"
    printf "    brew install nvm  &&  nvm install --lts\n"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    err "npm is not installed (it ships with Node.js). Reinstall Node.js."
    exit 1
fi

# Parse `node -v` output (e.g. "v22.14.0") into major/minor.
NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_REST="${NODE_VERSION#*.}"
NODE_MINOR="${NODE_REST%%.*}"

ok "Node.js v${NODE_VERSION} found ($(command -v node))"
ok "npm $(npm -v) found ($(command -v npm))"

# Vite 8 requires Node >= 20.19, OR >= 22.12, OR >= 24.
node_ok=0
if [ "$NODE_MAJOR" -gt 24 ] 2>/dev/null; then
    node_ok=1
elif [ "$NODE_MAJOR" -eq 24 ] 2>/dev/null; then
    node_ok=1
elif [ "$NODE_MAJOR" -eq 22 ] 2>/dev/null && [ "$NODE_MINOR" -ge 12 ] 2>/dev/null; then
    node_ok=1
elif [ "$NODE_MAJOR" -eq 20 ] 2>/dev/null && [ "$NODE_MINOR" -ge 19 ] 2>/dev/null; then
    node_ok=1
fi

if [ "$node_ok" -ne 1 ]; then
    err "Node.js v${NODE_VERSION} is too old for Vite 8."
    printf "  Vite 8 requires Node >= 20.19, >= 22.12, or >= 24.\n"
    printf "  Upgrade with nvm:\n"
    printf "    nvm install 22  &&  nvm use 22\n"
    printf "  or with Homebrew:\n"
    printf "    brew upgrade node\n"
    exit 1
fi
ok "Node version satisfies Vite 8 (>= 20.19 / 22.12 / 24)."

# --- Action selection (parsed early so --help is side-effect-free) -------------
ACTION="${1:-dev}"

show_help() {
    printf "Usage: ./run-mac.sh [--dev|--build|--preview|--help]\n"
    printf "  (no arg) / --dev    Start the Vite dev server (default)\n"
    printf "  --build             Build the production bundle to dist/\n"
    printf "  --preview           Serve the production build locally\n"
    printf "  --help              Show this help\n"
}

case "$ACTION" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    --dev|dev|--build|build|--preview|preview) ;;
        *)
        err "Unknown action: $ACTION"
        printf "  Run ./run-mac.sh --help for usage.\n"
        exit 1
        ;;
esac

# --- Dependencies --------------------------------------------------------------
info "Checking dependencies..."

NEEDS_INSTALL=0
if [ ! -d "node_modules" ]; then
    NEEDS_INSTALL=1
elif [ ! -f "node_modules/.package-lock.json" ]; then
    NEEDS_INSTALL=1
elif [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
    warn "package-lock.json is newer than installed deps."
    NEEDS_INSTALL=1
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
    # Use `npm install` (not `npm ci`) so an out-of-sync lock file self-heals.
    # `npm ci` is strict and fails when package.json and the lock diverge — common when
    # deps were added/changed without re-running install. `npm install` reconciles them.
    info "Installing dependencies via npm install..."
    npm install
    ok "Dependencies installed."
else
    ok "Dependencies up to date (node_modules present)."
fi

# --- Run the selected action ---------------------------------------------------
case "$ACTION" in
    --dev|dev)
        printf "\n${BOLD}Starting Vite dev server...${RESET}\n"
        printf "  Default URL: ${BOLD}http://localhost:5173${RESET}\n"
        printf "  (If 5173 is busy, Vite picks the next free port — check the output below.)\n"
        printf "  Press Ctrl+C to stop.\n\n"
        npm run dev
        ;;
    --build|build)
        printf "\n${BOLD}Building production bundle...${RESET}\n"
        npm run build
        ok "Build complete -> dist/"
        ;;
    --preview|preview)
        printf "\n${BOLD}Previewing production build...${RESET}\n"
        printf "  Default URL: ${BOLD}http://localhost:4173${RESET}\n\n"
        npm run preview
        ;;
esac
