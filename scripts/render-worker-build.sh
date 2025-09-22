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

cd bot

log "Inspecting bot source tree"
ls -la src || true

responses_dir="src/bot responses"
if [ ! -d "$responses_dir" ]; then
  log "Bot responses directory missing, creating placeholder"
  mkdir -p "$responses_dir"
fi
ls -la "$responses_dir" || true

log "Bot workspace ready for Render"
