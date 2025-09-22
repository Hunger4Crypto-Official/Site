#!/bin/bash
# Render.com worker build script for the Discord bot
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/render-common.sh"

trap 'log "Render bot build failed on line $LINENO"' ERR

setup_npm_env

log "H4C Bot Build Script Starting"
log "Current directory: $(pwd)"
log "Directory contents:"
ls -la
log "Node version: $(node --version)"
log "npm version: $(npm --version)"
log "Installing repository dependencies"
run_npm_install "."

log "Building shared workspace"
npm run build --workspace=@h4c/shared --if-present
log "Installing bot workspace dependencies"
if [ -f "package-lock.json" ] || [ -f "npm-shrinkwrap.json" ]; then
  run_npm_install "." --omit=dev --workspace=@h4c/shared --workspace=@h4c/bot
else
  log "No root lockfile detected, falling back to direct workspace installs"
  [ -d "shared" ] && run_npm_install "shared" --omit=dev
  run_npm_install "bot" --omit=dev
fi

if [ -d "shared" ]; then
  log "Installing shared workspace dependencies"
  run_npm_install "shared" --omit=dev
else
  log "Shared workspace not found, skipping install"
fi

log "Installing bot workspace dependencies"
run_npm_install "bot" --omit=dev

cd bot

log "Inspecting bot source tree"
ls -la src || true

responses_dir="src/bot responses"
if [ ! -d "$responses_dir" ]; then
  log "Bot responses directory missing, creating placeholder"
  mkdir -p "$responses_dir"
fi
ls -la "$responses_dir" || true

if ! npm ls @h4c/shared --depth=0 >/dev/null 2>&1; then
  log "@h4c/shared dependency missing after install, linking locally"
  npm install --no-save --no-package-lock --no-audit --no-fund ../shared
else
  log "@h4c/shared workspace dependency verified"
  log "Linking @h4c/shared dependency for bot runtime"
  npm install --no-save --no-package-lock --no-audit --no-fund ../shared
else
  log "@h4c/shared workspace dependency already linked"
fi

log "Bot workspace ready for Render"
