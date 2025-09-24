#!/bin/bash
# Render.com build script for H4C monorepo
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/render-common.sh"

trap 'log "Render web build failed on line $LINENO"' ERR

setup_npm_env

ensure_workspace_packages() {
  local install_specs=()
  local requested=("$@")

  for pkg in "${requested[@]}"; do
    if npm ls "$pkg" --depth=0 >/dev/null 2>&1; then
      continue
    fi

    local version=""
    local version_output=""
    version_output=$(PKG_NAME="$pkg" node -e '
const fs = require("fs");
const path = require("path");

const manifestPath = path.resolve("package.json");
if (!fs.existsSync(manifestPath)) {
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies"
];

for (const section of sections) {
  const block = manifest[section];
  if (block && block[process.env.PKG_NAME]) {
    process.stdout.write(String(block[process.env.PKG_NAME]));
    process.exit(0);
  }
}

process.exit(1);
' 2>/dev/null) || version_output=""

    version=${version_output//$'\n'/}

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

ensure_sample_content() {
  local targets=(
    "content/mega_article"
    "web/content/mega_article"
  )

  for target in "${targets[@]}"; do
    if [ ! -d "$target" ]; then
      log "Creating sample content directory at $target"
      mkdir -p "$target"
    fi

    if [ ! -f "$target/01-foreword.json" ]; then
      cat <<'JSON' > "$target/01-foreword.json"
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
    fi

    if [ ! -f "$target/02-bitcoin.json" ]; then
      cat <<'JSON' > "$target/02-bitcoin.json"
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
    fi

    if [ ! -f "$target/03-ethereum.json" ]; then
      cat <<'JSON' > "$target/03-ethereum.json"
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
    fi

    if [ ! -f "$target/04-algorand.json" ]; then
      cat <<'JSON' > "$target/04-algorand.json"
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
    fi
  done
}

ensure_next_env() {
  local file="web/next-env.d.ts"

  if [ ! -f "$file" ]; then
    log "Creating $file"
    cat <<'NEXT' > "$file"
/// <reference types="next" />
/// <reference types="next/image-types/global" />
NEXT
  fi
}

log "H4C Web build starting"
log "Working directory: $(pwd)"
ls -la
log "Node version: $(node --version)"
log "npm version: $(npm --version)"

ensure_sample_content
ensure_next_env

log "Installing repository dependencies"
run_npm_install "." --include=dev

log "Ensuring TypeScript toolchain is present"
ensure_workspace_packages typescript @types/react @types/react-dom @types/node

log "Verifying content accessibility"
ls -la content/mega_article/ 2>/dev/null || log "No content dir at repo root"
ls -la web/content/mega_article/ 2>/dev/null || log "No content dir at web workspace"

log "Building shared workspace"
npm run build --workspace=@h4c/shared --if-present

log "Building web application"
npm run build --workspace=@h4c/web

log "Listing web build artifacts"
ls -la web/.next/ || true

log "H4C Web build complete"
