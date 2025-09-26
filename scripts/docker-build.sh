#!/bin/bash

echo "🐳 Docker Build Process Starting..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your actual values before running!"
    exit 1
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down

# Remove old images
echo "🗑️  Removing old images..."
docker rmi h4c-bot h4c-web 2>/dev/null || true

# Build fresh images
echo "🔨 Building Docker images..."
docker-compose build --no-cache

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "To start the services, run:"
    echo "  docker-compose up -d"
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"
else
    echo "❌ Build failed! Check the error messages above."
    exit 1
fi
