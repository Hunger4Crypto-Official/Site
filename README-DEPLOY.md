# H4C Deployment Guide

## Prerequisites

- Node.js 18+
- MongoDB database
- Redis instance
- Discord Bot Token
- Environment variables configured

## Environment Variables

Create `.env` in the root directory:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/h4c
REDIS_URL=redis://localhost:6379

# Discord Bot
BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id

# Security
ADMIN_JWT_SECRET=your_very_long_random_secret_at_least_32_chars

# Blockchain APIs
ALGORAND_NODE_URL=https://mainnet-api.algonode.cloud
NODELY_INDEXER_URL=https://mainnet-api.4160.nodely.dev
NODELY_INDEXER_API_KEY=your_nodely_api_key
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your_key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# DEX APIs
TINYMAN_API=https://mainnet.analytics.tinyman.org/api/v1
ENABLE_TINYMAN=true
ENABLE_PACT=false
PACT_API_BASE=

# Discord Role IDs (get from Discord developer portal)
ROLE_CITIZEN_ID=
ROLE_HODL_SHRIMP_ID=
ROLE_HODL_CRAB_ID=
ROLE_HODL_FISH_ID=
ROLE_HODL_DOLPHIN_ID=
ROLE_HODL_SHARK_ID=
ROLE_HODL_WHALE_ID=
ROLE_HODL_TITAN_ID=

# Performance Tuning
ALG_BALANCE_TTL_MS=60000
BUCKETS=10
BUCKET_PERIOD_MIN=5
SCAN_CONCURRENCY=3
SCAN_SPACING_MS=1000
GLOBAL_CALL_BUDGET_5M=300

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_TOKENS=120
RATE_LIMIT_REFILL_PER_SEC=2
RATE_LIMIT_BURST=20

# Admin Rate Limiting
ADMIN_RATE_LIMIT_WINDOW_MS=60000
ADMIN_RATE_LIMIT_MAX_TOKENS=30
ADMIN_RATE_LIMIT_REFILL_PER_SEC=1
ADMIN_RATE_LIMIT_BURST=5
ADMIN_IP_ALLOWLIST=127.0.0.1,10.0.0

# Other
REP_V2_TTL_SECS=900
LP_SNAPSHOT_TTL_SECS=7200
NEXT_PUBLIC_SITE_URL=https://hunger4crypto.com
ALGO_USD_FALLBACK=0.20
```

## Local Development

1. **Install dependencies:**
```bash
npm run install:all
```

2. **Seed badge data:**
```bash
npm run seed:badges
```

3. **Start development servers:**
```bash
npm run dev
```

This starts:
- Web app on http://localhost:3001
- Bot API on http://localhost:3000

## Production Deployment

### Option 1: Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Render.com

1. Fork this repository
2. Connect to Render.com
3. Use the provided `render.yaml` configuration
4. Set required environment variables in Render dashboard
5. Deploy automatically on git push

### Option 3: Manual Server Deployment

1. **Install Node.js 18+ on server**

2. **Clone repository:**
```bash
git clone https://github.com/your-org/h4c-monorepo.git
cd h4c-monorepo
```

3. **Install dependencies:**
```bash
npm run install:all
```

4. **Set environment variables**
```bash
cp .env.example .env
# Edit .env with your values
```

5. **Build applications:**
```bash
npm run build
```

6. **Set up process manager (PM2):**
```bash
npm install -g pm2

# Start bot
pm2 start bot/src/index.js --name h4c-bot

# Start web
pm2 start web/package.json --name h4c-web -- start

# Save PM2 config
pm2 save
pm2 startup
```

7. **Set up reverse proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name hunger4crypto.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/bot {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## Discord Bot Setup

1. **Create Discord Application:**
   - Go to https://discord.com/developers/applications
   - Create new application
   - Go to "Bot" section
   - Create bot and copy token to `BOT_TOKEN`

2. **Invite Bot to Server:**
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268435456&scope=bot%20applications.commands
   ```

3. **Get Discord IDs:**
   - Enable Developer Mode in Discord
   - Right-click server → Copy ID (for `DISCORD_GUILD_ID`)
   - Right-click roles → Copy ID (for role environment variables)

## Database Setup

### MongoDB

```javascript
// Create indexes
db.users.createIndex({ discordId: 1 }, { unique: true, sparse: true })
db.users.createIndex({ walletAddress: 1 })
db.users.createIndex({ email: 1 }, { sparse: true })
db.badges.createIndex({ badgeId: 1 }, { unique: true })
```

### Redis

No special setup required, just ensure Redis is running and accessible.

## Health Checks

- Bot API: `GET /health`
- Web API: `GET /api/health` 
- Metrics: `GET /metrics` (Prometheus format)

## Monitoring

The bot exposes Prometheus metrics at `/metrics`:
- HTTP request counts
- Error rates
- Indexer call statistics
- Awards and role sync counts
- Uptime

## Troubleshooting

### Common Issues

1. **Bot won't start:**
   - Check Discord token is valid
   - Verify MongoDB connection
   - Check Redis connectivity

2. **Badge awards not working:**
   - Verify Algorand indexer API key
   - Check rate limiting settings
   - Review user wallet verification

3. **Web build fails:**
   - Ensure all article JSON files are valid
   - Check Next.js version compatibility
   - Verify TypeScript configuration

### Logs

```bash
# Bot logs
pm2 logs h4c-bot

# Web logs  
pm2 logs h4c-web

# Or with Docker
docker-compose logs -f bot
docker-compose logs -f web
```

### Performance Tuning

- Adjust `SCAN_CONCURRENCY` for badge evaluation speed
- Tune `GLOBAL_CALL_BUDGET_5M` for API rate limits
- Monitor Redis memory usage for caching
- Scale horizontally by running multiple bot instances

## Security Considerations

- Keep `ADMIN_JWT_SECRET` secure and rotate regularly
- Use HTTPS in production
- Restrict admin IP allowlist
- Monitor rate limiting logs
- Keep dependencies updated
