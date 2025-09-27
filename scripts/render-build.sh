#!/bin/bash
# Render build script tuned for Render.com environment
set -e

echo "🚀 Starting H4C Render Build Process..."

# Set Node version for compatibility
export NODE_VERSION="18.20.5"

# Enable verbose logging for debugging
export NPM_CONFIG_LOGLEVEL=info

echo "📋 Environment Info:"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"
echo "Available files: $(ls -la)"

# Clean any existing builds
echo "🧹 Cleaning previous builds..."
rm -rf web/.next web/dist web/build
rm -rf bot/dist bot/build
rm -rf shared/dist shared/build

# Install root dependencies first
echo "📦 Installing root dependencies..."
npm ci --production=false

# Build shared package first (dependency for others)
echo "🔧 Building shared package..."
cd shared
echo "In shared directory: $(pwd)"
npm ci --production=false

# Shared might not have a build step, but if it does:
if npm run | grep -q "build"; then
    echo "Building shared package..."
    npm run build
else
    echo "No build script in shared - skipping"
fi
cd ..

# Build web application
echo "🌐 Building web application..."
cd web
echo "In web directory: $(pwd)"

# Install web dependencies
npm ci --production=false

# Verify TypeScript is available
if ! command -v npx &> /dev/null || ! npx tsc --version &> /dev/null; then
    echo "❌ TypeScript not found, installing..."
    npm install typescript@^5.9.2
fi

# Check if Next.js config exists
if [ ! -f "next.config.js" ]; then
    echo "⚠️  No next.config.js found, creating minimal config..."
    cat > next.config.js << 'EOF_CONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    esmExternals: false,
  },
  transpilePackages: ['@h4c/shared'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
EOF_CONFIG
fi

# Build the web application
echo "Building Next.js application..."
npm run build

cd ..

# Build bot (if needed)
echo "🤖 Preparing bot..."
cd bot
echo "In bot directory: $(pwd)"

npm ci --production=false

# Bot is JavaScript, so just verify it's ready
if npm run | grep -q "build"; then
    echo "Building bot..."
    npm run build
else
    echo "No build script for bot - JavaScript ready to run"
fi

cd ..

echo "✅ Build completed successfully!"
echo "📁 Final directory structure:"
ls -la
echo "📁 Web build output:"
ls -la web/.next/ || echo "No .next directory found"
echo "📁 Web static files:"
ls -la web/public/ || echo "No public directory found"

echo "🎉 H4C Build Process Complete!"
