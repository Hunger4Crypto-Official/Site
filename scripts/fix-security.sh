#!/bin/bash
# Fix security vulnerabilities

set -e

echo "🔒 Fixing security vulnerabilities..."

# Fix root level vulnerabilities
echo "Fixing root package vulnerabilities..."
npm audit fix --force

# Fix shared workspace vulnerabilities
echo "Fixing shared workspace vulnerabilities..."
cd shared
npm audit fix --force
cd ..

# Fix web workspace vulnerabilities
echo "Fixing web workspace vulnerabilities..."
cd web
npm audit fix --force
cd ..

# Fix bot workspace vulnerabilities
echo "Fixing bot workspace vulnerabilities..."
cd bot
npm audit fix --force
cd ..

echo "✅ Security vulnerabilities fixed!"
echo "🔄 Regenerating lock files..."

# Regenerate all lock files
npm install
cd shared && npm install && cd ..
cd web && npm install && cd ..
cd bot && npm install && cd ..

echo "✅ All lock files updated!"
