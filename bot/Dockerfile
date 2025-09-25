# bot/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# Copy shared module first
FROM base AS shared
COPY shared/package*.json ./shared/
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Build bot with shared module
FROM base AS builder
WORKDIR /app

# Copy shared from previous stage
COPY --from=shared /app/shared ./shared

# Copy bot package files
COPY bot/package*.json ./bot/

# Install bot dependencies
WORKDIR /app/bot
RUN npm ci --omit=dev || npm install --omit=dev

# Link shared module
RUN npm install ../shared --install-links

# Copy bot source code
COPY bot/ .

# Final production image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 botuser

# Copy everything from builder
COPY --from=builder --chown=botuser:nodejs /app/shared ./shared
COPY --from=builder --chown=botuser:nodejs /app/bot ./bot

# Set working directory to bot
WORKDIR /app/bot

USER botuser

EXPOSE 3000

CMD ["node", "src/index.js"]
