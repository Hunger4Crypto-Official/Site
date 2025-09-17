import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { logger } from './utils/logger.js';
import { Env, assertRequiredEnv, assertStrongSecret, assertUrlNoV2 } from './utils/envGuard.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { tokenBucket, adminGuard } from './middleware/rateLimit.js';
import { loadSlashCommands } from './slash/loader.js';
import { redis } from './utils/redisClient.js';
import { startAutoAwards } from './cron/autoAwards.js';
import { RoleManagementService } from './services/roleManagementService.js';
import { AlgorandLeaderboardService } from './services/algorandLeaderboardService.js';

// Get package info safely
const pkg = {
  name: "@h4c/bot",
  version: process.env.npm_package_version || "1.0.0"
};

// Env sanity
assertRequiredEnv([
  'MONGODB_URI','REDIS_URL','BOT_TOKEN','DISCORD_GUILD_ID','ADMIN_JWT_SECRET','ALGORAND_NODE_URL'
]);
assertStrongSecret('ADMIN_JWT_SECRET', 32);
assertUrlNoV2('NODELY_INDEXER_URL');

// DB/Redis
await mongoose.connect(Env.MONGODB_URI);
redis.on('error', err => logger.error({ err }, 'Redis error'));

// HTTP server
const app = express();
app.use(requestIdMiddleware);
app.use(metricsMiddleware);

// Public rate limiter
const publicLimiter = tokenBucket({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  maxTokens: Number(process.env.RATE_LIMIT_MAX_TOKENS || 120),
  refillPerSec: Number(process.env.RATE_LIMIT_REFILL_PER_SEC || 2),
  burst: Number(process.env.RATE_LIMIT_BURST || 20),
  bucket: 'public'
});
app.use(publicLimiter);

// Health/metrics/version
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/metrics', metricsHandler);
app.get('/version', (_req, res) =>
  res.json({ name: pkg.name, version: pkg.version, commit: process.env.GIT_COMMIT || 'dev' })
);

// Admin limiter + endpoint
const adminLimiter = adminGuard({
  windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || 60000),
  maxTokens: Number(process.env.ADMIN_RATE_LIMIT_MAX_TOKENS || 30),
  refillPerSec: Number(process.env.ADMIN_RATE_LIMIT_REFILL_PER_SEC || 1),
  burst: Number(process.env.ADMIN_RATE_LIMIT_BURST || 5)
});

app.post('/admin/rolesync', adminLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== process.env.ADMIN_JWT_SECRET) return res.status(401).json({ ok:false, error:'unauthorized' });

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return res.status(500).json({ ok:false, error:'guild not ready' });

    const out = await RoleManagementService.batchSyncHodlRoles(guild);
    return res.json({ ok:true, ...out });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

// LP leaderboard snapshot API
app.get('/api/leaderboard/lp', async (_req, res) => {
  try {
    const snap = await AlgorandLeaderboardService.getSnapshot();
    res.json({ ok:true, ...snap });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

app.listen(3000, () => logger.info('HTTP server on :3000'));

// Discord client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

client.once('ready', async () => {
  // robust slash registration with retry
  for (let i=0; i<3; i++){
    try { await loadSlashCommands(client); break; }
    catch (e) { logger.error({ e }, 'Slash register failed'); await new Promise(r => setTimeout(r, 1000*(i+1))); }
  }
  startAutoAwards(client);
  logger.info({ user: client.user.tag }, 'Bot ready');
});

client.login(Env.BOT_TOKEN);
