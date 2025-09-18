import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
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

// FIXED: Add JWT middleware for proper authentication
function verifyAdminToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'No token provided' });
    }

    // Try JWT verification first
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
      }
      req.user = decoded;
      return next();
    } catch (jwtError) {
      // Fallback to direct secret comparison for backward compatibility
      // TODO: Remove this after migration period
      if (token === process.env.ADMIN_JWT_SECRET) {
        logger.warn('Using deprecated direct secret authentication');
        req.user = { role: 'admin', deprecated: true };
        return next();
      }
      
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Admin authentication error');
    return res.status(500).json({ ok: false, error: 'Authentication error' });
  }
}

// FIXED: Add token generation endpoint for admins
function generateAdminToken() {
  return jwt.sign(
    { 
      role: 'admin',
      issued: Date.now(),
      version: '1.0'
    },
    process.env.ADMIN_JWT_SECRET,
    { 
      expiresIn: '24h',
      issuer: 'h4c-bot',
      audience: 'h4c-admin'
    }
  );
}

// DB/Redis with proper error handling
await mongoose.connect(Env.MONGODB_URI);
redis.on('error', err => logger.error({ err }, 'Redis error'));

// FIXED: Add graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await mongoose.disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await mongoose.disconnect();
  redis.disconnect();
  process.exit(0);
});

// HTTP server
const app = express();
app.use(express.json({ limit: '1mb' }));
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

// FIXED: Enhanced health check with dependency testing
app.get('/health', async (_req, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {}
  };

  // Check MongoDB
  try {
    await mongoose.connection.db.admin().ping();
    health.dependencies.mongodb = 'healthy';
  } catch (error) {
    health.dependencies.mongodb = 'unhealthy';
    health.ok = false;
  }

  // Check Redis
  try {
    await redis.ping();
    health.dependencies.redis = 'healthy';
  } catch (error) {
    health.dependencies.redis = 'unhealthy';
    health.ok = false;
  }

  // Check Discord client
  if (client.isReady()) {
    health.dependencies.discord = 'healthy';
  } else {
    health.dependencies.discord = 'unhealthy';
    health.ok = false;
  }

  res.status(health.ok ? 200 : 503).json(health);
});

app.get('/metrics', metricsHandler);
app.get('/version', (_req, res) =>
  res.json({ name: pkg.name, version: pkg.version, commit: process.env.GIT_COMMIT || 'dev' })
);

// FIXED: Add admin token generation endpoint (temporary, for setup)
app.post('/admin/generate-token', (req, res) => {
  // Only allow from localhost or if emergency flag is set
  const clientIp = req.socket.remoteAddress;
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  const emergencyMode = process.env.EMERGENCY_TOKEN_GENERATION === 'true';
  
  if (!isLocalhost && !emergencyMode) {
    return res.status(403).json({ ok: false, error: 'Not authorized' });
  }

  try {
    const token = generateAdminToken();
    logger.warn({ clientIp }, 'Admin token generated');
    res.json({ 
      ok: true, 
      token,
      expiresIn: '24h',
      note: 'Store this token securely. This endpoint will be disabled in production.'
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Token generation failed');
    res.status(500).json({ ok: false, error: 'Token generation failed' });
  }
});

// Admin limiter + endpoints
const adminLimiter = adminGuard({
  windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || 60000),
  maxTokens: Number(process.env.ADMIN_RATE_LIMIT_MAX_TOKENS || 30),
  refillPerSec: Number(process.env.ADMIN_RATE_LIMIT_REFILL_PER_SEC || 1),
  burst: Number(process.env.ADMIN_RATE_LIMIT_BURST || 5)
});

// FIXED: Use proper JWT verification for admin endpoints
app.post('/admin/rolesync', adminLimiter, verifyAdminToken, async (req, res) => {
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return res.status(500).json({ ok:false, error:'guild not ready' });

    const out = await RoleManagementService.batchSyncHodlRoles(guild);
    return res.json({ ok:true, ...out });
  } catch (e) {
    logger.error({ error: String(e) }, 'Role sync failed');
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

// LP leaderboard snapshot API
app.get('/api/leaderboard/lp', async (_req, res) => {
  try {
    const snap = await AlgorandLeaderboardService.getSnapshot();
    res.json({ ok:true, ...snap });
  } catch (e) {
    logger.error({ error: String(e) }, 'Leaderboard fetch failed');
    res.status(500).json({ ok:false, error:String(e) });
  }
});

// FIXED: Enhanced email subscription with better error handling
app.post('/api/email/web-subscribe', adminLimiter, verifyAdminToken, async (req, res) => {
  try {
    const { email, source, userAgent, ip } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'email required' });
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, error: 'invalid email' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for disposable email domains
    const disposableDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    const domain = cleanEmail.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return res.status(400).json({ ok: false, error: 'disposable email not allowed' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    
    if (existingUser) {
      // Update the existing record with new collection info
      await User.findOneAndUpdate(
        { email: cleanEmail },
        { 
          emailCollectedAt: new Date(),
          $push: {
            emailSources: {
              source: source || 'web',
              collectedAt: new Date(),
              userAgent: (userAgent || '').substring(0, 200), // Limit length
              ip: ip ? ip.substring(0, 12) + '***' : ''
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
          userAgent: (userAgent || '').substring(0, 200),
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
app.get('/api/email/export', adminLimiter, verifyAdminToken, async (req, res) => {
  try {
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
app.get('/api/email/stats', adminLimiter, verifyAdminToken, async (req, res) => {
  try {
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
app.post('/api/email/bulk-unsubscribe', adminLimiter, verifyAdminToken, async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ ok: false, error: 'emails array required' });
    }

    if (emails.length > 1000) {
      return res.status(400).json({ ok: false, error: 'too many emails, max 1000' });
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

// FIXED: Add request timeout middleware
app.use((req, res, next) => {
  const timeout = 30000; // 30 seconds
  req.setTimeout(timeout, () => {
    logger.warn({ url: req.url, method: req.method }, 'Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ ok: false, error: 'Request timeout' });
    }
  });
  next();
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
