#!/bin/bash
# Install missing dependencies in the correct workspaces

set -e

echo "📦 Installing missing dependencies..."

# Web workspace - ensure all TypeScript and build dependencies are present
echo "Installing web dependencies..."
cd web

# Install missing TypeScript dependencies
npm install --save-dev \
  typescript@^5.9.2 \
  @types/node@^22.7.5 \
  @types/react@^18.3.11 \
  @types/react-dom@^18.3.0 \
  eslint@^8.57.0 \
  eslint-config-next@14.2.16

# Ensure Next.js is latest stable version
npm install next@14.2.16

cd ..

# Bot workspace - ensure all Node.js dependencies are present
echo "Installing bot dependencies..."
cd bot

# Install missing Node.js type definitions for better development
npm install --save-dev \
  @types/node@^24.5.2

cd ..

# Shared workspace - ensure all common dependencies are present
echo "Installing shared dependencies..."
cd shared

# Install any missing shared dependencies
npm install --save-dev \
  @types/node@^24.5.2

cd ..

# Root level - ensure development tools are present
echo "Installing root development dependencies..."
npm install --save-dev \
  @types/node@^24.5.2

echo "✅ All dependencies installed!"

# Verify installations
echo "🔍 Verifying TypeScript installations..."
cd web && npx tsc --version && cd ..
cd bot && echo "Bot: JavaScript project - no TypeScript check needed" && cd ..

echo "✅ Dependencies verification complete!"
