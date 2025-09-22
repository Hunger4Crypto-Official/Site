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

retry_command() {
  local attempts="$1"
  local delay="$2"
  shift 2 || true

  local try=1
  local exit_code=0

  while [ "$try" -le "$attempts" ]; do
    if "$@"; then
      return 0
    fi

    exit_code=$?
    if [ "$try" -lt "$attempts" ]; then
      log "Command failed (attempt $try/$attempts). Retrying in ${delay}s..."
      sleep "$delay"
      delay=$((delay * 2))
    fi

    try=$((try + 1))
  done

  return "$exit_code"
}

run_in_dir() {
  local dir="$1"
  shift || true
  (cd "$dir" && "$@")
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
  export NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"
  export NPM_CONFIG_FETCH_TIMEOUT="${NPM_CONFIG_FETCH_TIMEOUT:-300000}"
  export NPM_CONFIG_FETCH_RETRIES="${NPM_CONFIG_FETCH_RETRIES:-10}"
  export NPM_CONFIG_FETCH_RETRY_MINTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MINTIMEOUT:-60000}"
  export NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT="${NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT:-300000}"
  export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$HOME/.npm}"
  export H4C_NPM_INSTALL_ATTEMPTS="${H4C_NPM_INSTALL_ATTEMPTS:-4}"
  export H4C_NPM_INSTALL_DELAY="${H4C_NPM_INSTALL_DELAY:-10}"
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
    retry_command "$H4C_NPM_INSTALL_ATTEMPTS" "$H4C_NPM_INSTALL_DELAY" run_in_dir "$dir" npm ci "${install_args[@]}"
  else
    log "No lockfile found in $resolved_dir, running npm install"
    retry_command "$H4C_NPM_INSTALL_ATTEMPTS" "$H4C_NPM_INSTALL_DELAY" run_in_dir "$dir" npm install "${install_args[@]}"
    (cd "$dir" && npm ci "${install_args[@]}")
  else
    log "No lockfile found in $resolved_dir, running npm install"
    (cd "$dir" && npm install "${install_args[@]}")
  fi
}

