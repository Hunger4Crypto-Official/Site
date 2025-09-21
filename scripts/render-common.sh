#!/bin/bash

# Shared helpers for Render build scripts. These utilities intentionally avoid
# side effects beyond environment configuration so they can be sourced by both
# the web and worker build pipelines.

if [ "${H4C_RENDER_COMMON_SOURCED:-0}" -eq 1 ]; then
  return 0
fi

export H4C_RENDER_COMMON_SOURCED=1

log() {
  printf '=== %s ===\n' "$*"
}

setup_npm_env() {
  if [ "${H4C_RENDER_NPM_ENV:-0}" -eq 1 ]; then
    return 0
  fi

  export H4C_RENDER_NPM_ENV=1

  # Ensure dev dependencies are always available even when Render sets
  # NODE_ENV=production. We also widen network timeouts so transient registry
  # hiccups don't abort a build mid-install.
  export NPM_CONFIG_PRODUCTION=false
  export NPM_CONFIG_AUDIT=false
  export NPM_CONFIG_FUND=false
  export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-120000}"
  export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-5}"
  export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MINTIMEOUT:-20000}"
  export NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT:-120000}"
  export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$HOME/.npm}"
}

run_npm_install() {
  setup_npm_env

  local dir="$1"
  shift || true
  local extra_args=("$@")

  local resolved_dir
  resolved_dir=$(cd "$dir" && pwd)

  local install_args=(--no-audit --no-fund "${extra_args[@]}")

  if [ -f "$dir/package-lock.json" ] || [ -f "$dir/npm-shrinkwrap.json" ]; then
    log "Installing dependencies with npm ci in $resolved_dir"
    (cd "$dir" && npm ci "${install_args[@]}")
  else
    log "No lockfile found in $resolved_dir, running npm install"
    (cd "$dir" && npm install "${install_args[@]}")
  fi
}

