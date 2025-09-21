#!/bin/bash
# Render.com build script for H4C monorepo
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/render-common.sh"

trap 'log "Render web build failed on line $LINENO"' ERR

ensure_workspace_packages() {
  local install_specs=()
  local requested=("$@")

  for pkg in "${requested[@]}"; do
    if npm ls "$pkg" --depth=0 >/dev/null 2>&1; then
      continue
    fi

    local version=""
    if ! version=$(PKG_NAME="$pkg" node -e '
const fs = require("fs");
const path = require("path");
const manifestPath = path.resolve("package.json");
if (!fs.existsSync(manifestPath)) {
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

for (const section of sections) {
  const block = manifest[section];
  if (block && block[process.env.PKG_NAME]) {
    process.stdout.write(String(block[process.env.PKG_NAME]));
    process.exit(0);
  }
}

process.exit(1);
' 2>/dev/null); then
      version=""
    fi

    version=${version//$'\n'/}

    if [ -n "$version" ]; then
      install_specs+=("$pkg@$version")
    else
      install_specs+=("$pkg")
    fi
  done

  if [ ${#install_specs[@]} -gt 0 ]; then
    log "Installing missing workspace packages: ${install_specs[*]}"
    npm install --no-save --no-package-lock --no-audit --no-fund "${install_specs[@]}"
  else
    log "Verified required packages are already installed: ${requested[*]}"
  fi
}

setup_npm_env

log() {
  echo "=== $* ==="
}

run_npm_install() {
  local dir="$1"
  shift || true
  local args=("$@")

  local resolved_dir
  resolved_dir=$(cd "$dir" && pwd)

  if [ -f "$dir/package-lock.json" ] || [ -f "$dir/npm-shrinkwrap.json" ]; then
    log "Installing dependencies with npm ci in $resolved_dir"
    (cd "$dir" && npm ci "${args[@]}")
  else
    log "No lockfile found in $resolved_dir, running npm install"
    (cd "$dir" && npm install "${args[@]}")
  fi
}

create_sample_content() {
  log "Creating sample content files..."

  local targets=(
    "content/mega_article"
    "web/content/mega_article"
  )

  for target in "${targets[@]}"; do
    mkdir -p "$target"

    cat > "$target/01-foreword.json" <<'JSON'
{
  "slug": "foreword",
  "title": "Foreword: Why Crypto, Why Now",
  "description": "Introduction to cryptocurrency and blockchain",
  "sections": [
    {
      "heading": "Welcome to Hunger4Crypto",
      "body": "The story of cryptocurrency is a tale of trust, belief, rebellion, and reinvention. This guide cuts through the noise with playful, clear, and brutally honest insights."
    },
    {
      "heading": "Why This Guide Exists",
      "body": "When Bitcoin appeared in 2009, the world laughed. Now governments, banks, and billion dollar funds are deep in the game. If you're here, you're early enough to still matter."
    }
  ]
}
JSON

    cat > "$target/02-bitcoin.json" <<'JSON'
{
  "slug": "bitcoin",
  "title": "Bitcoin: The Genesis and Relentless Rise",
  "description": "Understanding the first cryptocurrency",
  "sections": [
    {
      "heading": "The Spark That Ignited a Revolution",
      "body": "In 2008, amid financial chaos, Satoshi Nakamoto dropped a nine-page PDF that would change money forever. Bitcoin wasn't just technology; it was rebellion."
    }
  ]
}
JSON

    cat > "$target/03-ethereum.json" <<'JSON'
{
  "slug": "ethereum",
  "title": "Ethereum: The World Computer",
  "description": "Smart contracts and programmable money",
  "sections": [
    {
      "heading": "From Bitcoin's Shadow",
      "body": "Vitalik Buterin saw Bitcoin's limitations and imagined bigger: a blockchain that could run smart contracts and decentralized applications."
    }
  ]
}
JSON

    cat > "$target/04-algorand.json" <<'JSON'
{
  "slug": "algorand",
  "title": "Algorand: The Green Speed Demon",
  "description": "Fast, eco-friendly blockchain",
  "sections": [
    {
      "heading": "The Elevator Pitch",
      "body": "Algorand is fast, eco-friendly, and designed by MIT professor Silvio Micali. Where Bitcoin makes you wait, Algorand zips through in seconds."
    }
  ]
}
JSON
  done

  log "Sample content created"
}

log "H4C Build Script Starting"
log "Current directory: $(pwd)"
log "Directory contents:"
ls -la
log "Node version: $(node --version)"
log "npm version: $(npm --version)"
log "Directory contents:" && ls -la

if [ -d "content/mega_article" ] || [ -d "web/content/mega_article" ]; then
  log "Content directory exists"
  ls -la content/mega_article/ 2>/dev/null || true
  ls -la web/content/mega_article/ 2>/dev/null || true
else
  log "Content directory missing, creating sample content..."
  create_sample_content
fi

log "Installing root dependencies"
if [ -f "package-lock.json" ] || [ -f "npm-shrinkwrap.json" ]; then
  if ! run_npm_install "." --omit=dev; then
    log "Root dependency installation failed or is unnecessary, continuing"
  fi
else
  log "No root lockfile detected, skipping root dependency installation"
fi

if [ -d "shared" ]; then
  log "Installing shared dependencies"
  if [ -f "shared/package-lock.json" ] || [ -f "shared/npm-shrinkwrap.json" ]; then
    if ! run_npm_install "shared" --omit=dev; then
      log "Shared dependency installation failed, continuing"
    fi
  else
    log "No shared lockfile detected, skipping shared dependency installation"
  fi
npm ci --production=false

if [ -d "shared" ]; then
  log "Installing shared dependencies"
  (cd shared && npm ci --production=false || true)
fi

log "Installing web dependencies"
cd web

if [ ! -f "next-env.d.ts" ]; then
  log "Creating next-env.d.ts..."
  cat <<'NEXT' > next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
NEXT
fi

previous_workspaces="${NPM_CONFIG_WORKSPACES-}"
export NPM_CONFIG_WORKSPACES=false
run_npm_install "." --include=dev
if [ -n "${previous_workspaces:-}" ]; then
  export NPM_CONFIG_WORKSPACES="$previous_workspaces"
else
  unset NPM_CONFIG_WORKSPACES
fi
ensure_workspace_packages typescript @types/react @types/react-dom @types/node
run_npm_install "." --production=false
npm ci --production=false

log "Verifying content accessibility"
ls -la content/mega_article/ 2>/dev/null || echo "No content dir at web level"
ls -la ../content/mega_article/ 2>/dev/null || echo "No content dir at root level"

log "Building web application"
npm run build

log "Build completed successfully"
ls -la .next/

log "H4C Build Complete"
