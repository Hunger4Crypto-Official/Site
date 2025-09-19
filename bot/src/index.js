// bot/src/index.js - ADVANCED VERSION WITH ALL IMPORTS + SAFETY
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';

// Import all advanced utilities and services
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

// Import GM responses!
import { gmResponses, randomFrom, cryptoJokes, techFacts } from './utils/botResponses.js';
import { Settings } from './utils/settings.js';
import { PersonalityService } from './services/personalityService.js';
import { CommunityEngagementService } from './services/communityEngagementService.js';
import { RandomChatterService } from './services/randomChatterService.js';
import { CommandRegistry } from './services/commandRegistry.js';

/* --------------------------- Enhanced Error Handling --------------------------- */
process.on('uncaughtException', (error) => {
  logger.error(error, '🚨 Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '🚨 Unhandled Rejection');
  process.exit(1);
});

/* --------------------------- Configuration & Constants --------------------------- */
const pkg = { name: '@h4c/bot', version: process.env.npm_package_version || '1.0.0' };
const ENABLE_HTTP = process.env.ENABLE_HTTP !== 'false';
const PORT = Number(process.env.PORT || 3000);

// Environment validation using imported guards
assertRequiredEnv([
  'BOT_TOKEN',
  'MONGODB_URI',
  'DISCORD_GUILD_ID',
  'ADMIN_JWT_SECRET'
]);

assertStrongSecret('ADMIN_JWT_SECRET', 32);

// Optional URL validations
if (process.env.ALGORAND_NODE_URL) {
  assertUrlNoV2('ALGORAND_NODE_URL');
}

const GN_RESPONSES = [
  'Power down, hero. Tomorrow needs your chaos. 🌙',
  'Rest up—your GM streak needs fuel. 😴',
  'Logging you out of reality for the night. 🔒',
  'Sweet dreams, legend. May your bags moon while you nap. 💫',
  'Night watch disengaged. Go recharge. 💤',
  'Dream in memes and manifest in pumps. 🌌'
];

/* --------------------------- Discord Client Setup --------------------------- */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel],
  allowedMentions: {
    parse: ['users', 'roles'],
    repliedUser: false
  }
});

client.slashCommands = new Collection();
let commandRegistry;

/* --------------------------- Express Server Setup --------------------------- */
const app = express();

// Enhanced middleware stack
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware for tracing
app.use(requestIdMiddleware);

// Metrics middleware for monitoring
app.use(metricsMiddleware);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-ID');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Request logging with enhanced details
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ 
      method: req.method, 
      url: req.url, 
      status: res.statusCode, 
      duration,
      requestId: req.requestId,
      userAgent: req.get('User-Agent')
    }, 'HTTP Request');
  });
  next();
});

/* --------------------------- Rate Limiting --------------------------- */
// Apply token bucket rate limiting to API routes
app.use('/api/', tokenBucket);

// Apply admin guard to admin routes
app.use('/api/admin/', adminGuard);

/* --------------------------- Enhanced API Routes --------------------------- */

// Health check with comprehensive status
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: pkg.name,
    version: pkg.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.requestId,
    discord: {
      ready: client.readyAt ? true : false,
      readyAt: client.readyAt,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      ping: client.ws.ping
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState
    },
    redis: redis ? {
      connected: redis.status === 'ready',
      status: redis.status
    } : null,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version
    }
  });
});

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      ok: false, 
      error: 'No token provided',
      requestId: req.requestId 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = decoded;
    logger.info({ adminId: decoded.id, requestId: req.requestId }, 'Admin authenticated');
    next();
  } catch (error) {
    logger.warn({ error: error.message, requestId: req.requestId }, 'Admin auth failed');
    return res.status(401).json({ 
      ok: false, 
      error: 'Invalid token',
      requestId: req.requestId 
    });
  }
};

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      logger.warn({ requestId: req.requestId, ip: req.ip }, 'Failed admin login attempt');
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid credentials',
        requestId: req.requestId 
      });
    }
    
    const token = jwt.sign(
      { 
        role: 'admin', 
        timestamp: Date.now(),
        id: 'admin'
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    logger.info({ requestId: req.requestId }, 'Admin login successful');
    res.json({ ok: true, token, requestId: req.requestId });
  } catch (error) {
    logger.error(error, 'Admin login error');
    res.status(500).json({ 
      ok: false, 
      error: 'Login failed',
      requestId: req.requestId 
    });
  }
});

// Enhanced user management with pagination and filtering
app.get('/api/users', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const filter = req.query.filter || {};
    
    // Build query filter
    const query = {};
    if (filter.hasWallet) {
      query.wallets = { $exists: true, $ne: [] };
    }
    if (filter.hasBadges) {
      query.badges = { $exists: true, $ne: [] };
    }
    if (filter.badgeType) {
      query['badges.type'] = filter.badgeType;
    }
    
    const users = await User.find(query)
      .select('discordId wallets badges reputation createdAt lastActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await User.countDocuments(query);
    
    // Redact sensitive wallet addresses for privacy
    const sanitizedUsers = users.map(user => ({
      ...user,
      wallets: user.wallets?.map(w => ({ 
        ...w, 
        address: w.address ? `${w.address.slice(0, 6)}…${w.address.slice(-4)}` : null
      }))
    }));
    
    logger.info({ 
      requestId: req.requestId, 
      page, 
      limit, 
      total,
      adminId: req.admin.id 
    }, 'Users fetched by admin');
    
    res.json({
      ok: true,
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      requestId: req.requestId
    });
  } catch (error) {
    logger.error({ error, requestId: req.requestId }, 'Failed to fetch users');
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch users',
      requestId: req.requestId 
    });
  }
});

// Enhanced badge management
app.post('/api/badges/award', authenticateAdmin, async (req, res) => {
  try {
    const { userId, badgeType, reason } = req.body;
    
    // Input validation
    if (!userId || !badgeType) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing userId or badgeType',
        requestId: req.requestId 
      });
    }
    
    if (!/^\d{17,19}$/.test(userId)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid Discord ID format',
        requestId: req.requestId 
      });
    }
    
    const user = await User.findOne({ discordId: userId });
    if (!user) {
      return res.status(404).json({ 
        ok: false, 
        error: 'User not found',
        requestId: req.requestId 
      });
    }
    
    // Check if badge already exists
    const existingBadge = user.badges?.find(b => b.type === badgeType);
    if (existingBadge) {
      return res.status(409).json({ 
        ok: false, 
        error: 'Badge already awarded',
        requestId: req.requestId 
      });
    }
    
    // Award the badge
    await User.updateOne(
      { discordId: userId },
      { 
        $push: { 
          badges: {
            type: badgeType,
            awardedAt: new Date(),
            reason: reason || 'Manually awarded by admin',
            awardedBy: 'admin'
          }
        }
      }
    );
    
    logger.info({ 
      userId, 
      badgeType, 
      reason, 
      requestId: req.requestId,
      adminId: req.admin.id 
    }, 'Badge awarded by admin');
    
    res.json({ 
      ok: true, 
      message: 'Badge awarded successfully',
      requestId: req.requestId 
    });
    
  } catch (error) {
    logger.error({ error, requestId: req.requestId }, 'Failed to award badge');
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to award badge',
      requestId: req.requestId 
    });
  }
});

// Comprehensive stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      bot: {
        uptime: process.uptime(),
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        commands: client.slashCommands.size,
        ping: client.ws.ping
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
    
    // Database stats
    if (mongoose.connection.readyState === 1) {
      stats.database = {
        totalUsers: await User.countDocuments(),
        usersWithWallets: await User.countDocuments({ wallets: { $exists: true, $ne: [] } }),
        usersWithBadges: await User.countDocuments({ badges: { $exists: true, $ne: [] } }),
        recentUsers: await User.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
      };
    }
    
    // Redis stats
    if (redis && redis.status === 'ready') {
      try {
        const info = await redis.info('memory');
        const memoryMatch = info.match(/used_memory_human:(\S+)/);
        stats.redis = {
          status: redis.status,
          memory: memoryMatch ? memoryMatch[1] : 'unknown'
        };
      } catch (redisError) {
        stats.redis = { status: redis.status, error: 'Could not fetch info' };
      }
    }
    
    logger.debug({ requestId: req.requestId }, 'Stats requested');
    res.json({ ok: true, stats, requestId: req.requestId });
  } catch (error) {
    logger.error({ error, requestId: req.requestId }, 'Failed to fetch stats');
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch stats',
      requestId: req.requestId 
    });
  }
});

// Leaderboard endpoints
app.get('/api/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    if (!AlgorandLeaderboardService) {
      return res.status(503).json({
        ok: false,
        error: 'Leaderboard service not available',
        requestId: req.requestId
      });
    }
    
    const leaderboard = await AlgorandLeaderboardService.getLeaderboard(type, { page, limit });
    
    logger.debug({ type, page, limit, requestId: req.requestId }, 'Leaderboard requested');
    res.json({ ok: true, leaderboard, requestId: req.requestId });
  } catch (error) {
    logger.error({ error, requestId: req.requestId }, 'Failed to fetch leaderboard');
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch leaderboard',
      requestId: req.requestId
    });
  }
});

/* --------------------------- Discord Event Handlers --------------------------- */

client.once('ready', async () => {
  logger.info({
    user: client.user.tag,
    guilds: client.guilds.cache.size,
    users: client.users.cache.size,
    ping: client.ws.ping
  }, 'Discord bot ready 🚀');

  CommunityEngagementService.initialize(client);
  RandomChatterService.initialize(client);
  commandRegistry = new CommandRegistry(client);

  // Load slash commands
  try {
    await loadSlashCommands(client);
    logger.info({ commandCount: client.slashCommands.size }, 'Slash commands loaded');
  } catch (error) {
    logger.error(error, 'Failed to load slash commands');
  }
  
  // Start auto awards system
  try {
    await startAutoAwards();
    logger.info('Auto awards system started');
  } catch (error) {
    logger.error(error, 'Failed to start auto awards');
  }
  
  // Initialize role management service
  if (RoleManagementService?.initialize) {
    try {
      await RoleManagementService.initialize();
      logger.info('Role management service initialized');
    } catch (error) {
      logger.error(error, 'Failed to initialize role management');
    }
  }

  // Initialize leaderboard service
  if (AlgorandLeaderboardService?.initialize) {
    try {
      await AlgorandLeaderboardService.initialize();
      logger.info('Algorand leaderboard service initialized');
    } catch (error) {
      logger.error(error, 'Failed to initialize leaderboard service');
    }
  }
});

client.on('error', (error) => {
  logger.error(error, 'Discord client error');
});

client.on('warn', (warning) => {
  logger.warn(warning, 'Discord client warning');
});

client.on('debug', (info) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug(info, 'Discord debug');
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    await CommunityEngagementService.ensureUser(member.user);
  } catch (error) {
    logger.error({ error: String(error), member: member.id }, 'Failed to ensure user on join');
  }

  const channelId = Settings.welcomeChannelId;
  if (!channelId) return;

  const channel = await CommunityEngagementService.resolveChannel(channelId);
  if (!channel) return;

  try {
    await channel.send(PersonalityService.welcomeMessage(member));
  } catch (error) {
    logger.error({ error: String(error), member: member.id }, 'Failed to send welcome message');
  }
});

// ----------- GM auto-reply handler -----------
client.on('messageCreate', async (message) => {
  if (
    message.author.bot ||
    !message.guild ||
    message.channel?.type !== 0
  ) return;

  const content = message.content?.trim();
  if (!content) return;

  const userRecord = await CommunityEngagementService.recordMessage(message);
  if (userRecord?.shadowbanned) return;

  if (commandRegistry && content.startsWith(Settings.prefix || '!')) {
    const handled = await commandRegistry.handle(message, userRecord);
    if (handled) return;
  }

  const normalized = content.toLowerCase();

  if (/^gm\b/.test(normalized)) {
    const result = await CommunityEngagementService.handleGreeting(message, 'gm', userRecord);
    if (result.updated) {
      await message.reply(PersonalityService.wrap(randomFrom(gmResponses), { user: message.author }));
      if (result.achievements?.length) {
        const unlocked = result.achievements.map(a => `**${a.label}**`).join(', ');
        await message.reply(PersonalityService.wrap(`Achievement unlocked: ${unlocked}`, { user: message.author, noSuffix: true }));
      }
    }
    return;
  }

  if (/^gn\b/.test(normalized)) {
    const result = await CommunityEngagementService.handleGreeting(message, 'gn', userRecord);
    if (result.updated) {
      await message.reply(PersonalityService.wrap(randomFrom(GN_RESPONSES), { user: message.author }));
      if (result.achievements?.length) {
        const unlocked = result.achievements.map(a => `**${a.label}**`).join(', ');
        await message.reply(PersonalityService.wrap(`Night shift unlocked: ${unlocked}`, { user: message.author, noSuffix: true }));
      }
    }
    return;
  }

  if (/(who\s+(owns|made|built)|owner|what\s+is\s+your\s+name|who\s+do\s+you\s+belong)/i.test(normalized)) {
    await message.reply(PersonalityService.ownerInfoReply(content));
    return;
  }

  if (/(tell me a joke|make me laugh)/i.test(normalized)) {
    await message.reply(PersonalityService.wrap(randomFrom(cryptoJokes), { user: message.author }));
    return;
  }

  if (/(drop a fact|teach me|random fact)/i.test(normalized)) {
    await message.reply(PersonalityService.wrap(randomFrom(techFacts), { user: message.author }));
    return;
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = client.slashCommands.get(interaction.commandName);
  if (!command) {
    logger.warn({ 
      command: interaction.commandName, 
      user: interaction.user.tag 
    }, 'Unknown command attempted');
    return;
  }
  
  const startTime = Date.now();
  
  try {
    await command.execute(interaction);
    const duration = Date.now() - startTime;
    
    logger.info({ 
      command: interaction.commandName, 
      user: interaction.user.tag,
      guild: interaction.guild?.name,
      duration
    }, 'Command executed successfully');
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({ 
      error, 
      command: interaction.commandName, 
      user: interaction.user.tag,
      duration
    }, 'Command execution failed');
    
    const reply = {
      content: 'There was an error executing this command. Please try again later.',
      ephemeral: true
    };
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (replyError) {
      logger.error(replyError, 'Failed to send error response');
    }
  }
});

/* --------------------------- Database Connection --------------------------- */
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    logger.info({
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    }, 'MongoDB connected successfully');
    
    // Set up MongoDB event listeners
    mongoose.connection.on('error', (error) => {
      logger.error(error, 'MongoDB connection error');
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
  } catch (error) {
    logger.error(error, 'MongoDB connection failed');
    throw error;
  }
};

/* --------------------------- Graceful Shutdown --------------------------- */
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  
  try {
    // Stop accepting new requests
    if (ENABLE_HTTP) {
      logger.info('Stopping HTTP server...');
    }
    
    // Destroy Discord client
    if (client.isReady()) {
      client.destroy();
      logger.info('Discord client destroyed');
    }
    
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');
    }
    
    // Close Redis connection
    if (redis && redis.status === 'ready') {
      await redis.quit();
      logger.info('Redis disconnected');
    }
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/* --------------------------- Startup Sequence --------------------------- */
const startup = async () => {
  try {
    logger.info({ 
      version: pkg.version,
      environment: process.env.NODE_ENV || 'development',
      port: PORT
    }, 'Starting H4C Bot...');
    
    // Connect to database
    await connectDatabase();
    
    // Login to Discord
    await client.login(process.env.BOT_TOKEN);
    
    // Start HTTP server if enabled
    if (ENABLE_HTTP) {
      app.listen(PORT, () => {
        logger.info({ port: PORT }, 'HTTP server started 🌐');
      });
    }
    
    logger.info('🚀 H4C Bot startup complete! All systems operational.');
    
  } catch (error) {
    logger.error(error, 'Startup failed');
    process.exit(1);
  }
};

// Start the application
startup();
