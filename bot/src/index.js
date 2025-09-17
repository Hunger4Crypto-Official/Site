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
import { User } from './database/models.js';

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
app.use(express.json({ limit: '1mb' })); // Add JSON parsing
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

// Email subscription from web
app.post('/api/email/web-subscribe', adminLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== process.env.ADMIN_JWT_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const { email, source, userAgent, ip } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'email required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid email' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    
    if (existingUser) {
      // Update the existing record with new collection info
      await User.findOneAndUpdate(
        { email: cleanEmail },
        { 
          emailCollectedAt: new Date(),
          // Store additional metadata if needed
          $push: {
            emailSources: {
              source: source || 'web',
              collectedAt: new Date(),
              userAgent: userAgent || '',
              ip: ip ? ip.substring(0, 12) + '***' : '' // Partial IP for privacy
            }
          }
        }
      );
      
      logger.info({ email: cleanEmail, source }, 'Email re-subscribed from web');
      return res.json({ ok: true, status: 'updated' });
    } else {
      // Create new user record for web-only subscription
      const newUser = new User({
        email: cleanEmail,
        emailCollectedAt: new Date(),
        emailSources: [{
          source: source || 'web',
          collectedAt: new Date(),
          userAgent: userAgent || '',
          ip: ip ? ip.substring(0, 12) + '***' : ''
        }]
      });
      
      await newUser.save();
      
      logger.info({ email: cleanEmail, source }, 'New email subscribed from web');
      return res.json({ ok: true, status: 'created' });
    }

  } catch (error) {
    logger.error({ error: String(error) }, 'Web email subscription failed');
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// Email list export (admin only)
app.get('/api/email/export', adminLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== process.env.ADMIN_JWT_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const users = await User.find({ 
      email: { $exists: true, $ne: null } 
    }).select('email emailCollectedAt discordId username emailSources -_id');

    const emailList = users.map(user => ({
      email: user.email,
      collectedAt: user.emailCollectedAt,
      hasDiscord: !!user.discordId,
      username: user.username || null,
      sources: user.emailSources || []
    }));

    return res.json({ 
      ok: true, 
      total: emailList.length,
      emails: emailList 
    });

  } catch (error) {
    logger.error({ error: String(error) }, 'Email export failed');
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// Email statistics endpoint
app.get('/api/email/stats', adminLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== process.env.ADMIN_JWT_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const totalUsers = await User.countDocuments();
    const emailUsers = await User.countDocuments({ email: { $exists: true, $ne: null } });
    const discordUsers = await User.countDocuments({ discordId: { $exists: true, $ne: null } });
    const bothUsers = await User.countDocuments({ 
      email: { $exists: true, $ne: null },
      discordId: { $exists: true, $ne: null }
    });

    // Recent subscriptions (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEmails = await User.countDocuments({
      emailCollectedAt: { $gte: sevenDaysAgo }
    });

    return res.json({
      ok: true,
      stats: {
        totalUsers,
        emailUsers,
        discordUsers,
        bothUsers,
        emailOnlyUsers: emailUsers - bothUsers,
        discordOnlyUsers: discordUsers - bothUsers,
        recentEmails,
        emailConversionRate: totalUsers > 0 ? (emailUsers / totalUsers * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    logger.error({ error: String(error) }, 'Email stats failed');
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// Bulk email unsubscribe (admin only) - for compliance
app.post('/api/email/bulk-unsubscribe', adminLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== process.env.ADMIN_JWT_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const { emails } = req.body;
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ ok: false, error: 'emails array required' });
    }

    const cleanEmails = emails.map(e => e.toLowerCase().trim()).filter(e => e);
    
    const result = await User.updateMany(
      { email: { $in: cleanEmails } },
      { 
        $unset: { email: 1, emailCollectedAt: 1, emailSources: 1 }
      }
    );

    logger.info({ count: result.modifiedCount, total: cleanEmails.length }, 'Bulk email unsubscribe');

    return res.json({
      ok: true,
      unsubscribed: result.modifiedCount,
      requested: cleanEmails.length
    });

  } catch (error) {
    logger.error({ error: String(error) }, 'Bulk unsubscribe failed');
    return res.status(500).json({ ok: false, error: 'internal error' });
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
