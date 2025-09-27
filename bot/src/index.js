import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { db as sqliteDb, improvedDb } from './database/sqlite.js';

import { Env } from './utils/envGuard.js';
import { logger } from './utils/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { checkRedisHealth, gracefulShutdown as shutdownRedis } from './utils/redisClient.js';
import { Settings } from './utils/settings.js';
import { CommandRegistry } from './services/commandRegistry.js';
import { CommunityEngagementService } from './services/communityEngagementService.js';
import { RandomChatterService } from './services/randomChatterService.js';
import { GreetingDetectionService } from './services/greetingDetectionService.js';
import { PersonalityService } from './services/personalityService.js';
import { randomFrom, gmResponses, gnResponses } from './utils/botResponses.js';
import { loadSlashCommands } from './slash/loader.js';
import { startAutoAwards } from './cron/autoAwards.js';

const mongooseOptions = {
  maxPoolSize: 5,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  autoIndex: false,
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

const app = express();
app.use(requestIdMiddleware);
app.use(metricsMiddleware);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  const memory = process.memoryUsage();
  const redis = await checkRedisHealth();
  const mongoState = mongoose.connection.readyState;

  res.json({
    ok: mongoState === 1 && redis.healthy,
    uptime: process.uptime(),
    discord: {
      loggedIn: Boolean(client?.user),
      username: client?.user?.tag ?? null,
    },
    mongo: {
      state: mongoState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    redis,
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
    },
  });
});

app.get('/metrics', metricsHandler);

const commandRegistry = new CommandRegistry(client);
const greetingDetection = new GreetingDetectionService();
const greetingConfig = GreetingDetectionService.getDetectionConfig(Settings);
let stopAutoAwards = null;
let httpServer;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('error', (error) => {
    logger.error({ error: String(error) }, 'MongoDB connection error');
  });

  await mongoose.connect(Env.MONGODB_URI, mongooseOptions);
}

client.once('ready', async () => {
  logger.info({ user: client.user.tag }, 'Discord bot ready');

  CommunityEngagementService.initialize(client);
  RandomChatterService.initialize(client);

  try {
    await loadSlashCommands(client);
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to register slash commands');
  }

  try {
    stopAutoAwards = startAutoAwards(client);
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to start auto-awards scheduler');
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content) return;

  let userDoc = null;
  try {
    userDoc = await CommunityEngagementService.recordMessage(message);
  } catch (error) {
    logger.warn({ error: String(error) }, 'Failed to record community message');
  }

  try {
    const handled = await commandRegistry.handle(message, userDoc);
    if (handled) return;
  } catch (error) {
    logger.error({ error: String(error) }, 'Command registry failed');
  }

  const detection = greetingDetection.detectGreeting(message.content, greetingConfig);
  if (!detection) return;

  const type = detection.type;

  try {
    const result = await CommunityEngagementService.handleGreeting(message, type, userDoc);
    if (!result) return;

    if (!result.updated) {
      if (result.reason === 'cooldown') {
        const next = result.nextAvailableAt ? new Date(result.nextAvailableAt) : null;
        const waitMinutes = next ? Math.max(1, Math.ceil((next.getTime() - Date.now()) / 60_000)) : null;
        const cooldownLine = waitMinutes
          ? `Cooldown active. Next ${type.toUpperCase()} available in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`
          : 'Cooldown active. Try again later.';
        await message.reply(PersonalityService.wrap(cooldownLine, { user: message.author, noPrefix: true }));
      }
      return;
    }

    const pool = type === 'gn' ? gnResponses : gmResponses;
    const base = randomFrom(pool) ?? (type === 'gn' ? 'gn' : 'gm');
    const streakLine = `Streak: ${result.streak ?? 1} • Total: ${result.count ?? 1}`;

    let reply = `${base}\n${streakLine}`;
    if (result.achievements?.length) {
      const unlocked = result.achievements.map((a) => `**${a.label}**`).join(', ');
      reply += `\nAchievement unlocked: ${unlocked}`;
    }

    await message.reply(PersonalityService.wrap(reply, { user: message.author }));
  } catch (error) {
    logger.error({ error: String(error), type }, 'Failed to process greeting');
  }
});

client.on('error', (error) => {
  logger.error({ error: String(error) }, 'Discord client error');
});

async function startHttpServer() {
  const port = Number(process.env.PORT || 3000);
  httpServer = app.listen(port, () => {
    logger.info({ port }, 'HTTP server listening');
  });
}

async function startup() {
  logger.info('Starting Gatekeeper 5000 bot...');

  await connectDatabase();
  await client.login(Env.BOT_TOKEN);
  await startHttpServer();
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down bot');

  if (stopAutoAwards) {
    try {
      stopAutoAwards();
    } catch (error) {
      logger.warn({ error: String(error) }, 'Failed to stop auto-awards cleanly');
    }
  }

  RandomChatterService.stop();

  try {
    await shutdownRedis();
  } catch (error) {
    logger.warn({ error: String(error) }, 'Redis shutdown warning');
  }

  if (client.isReady()) {
    await client.destroy();
// MEMORY FIX 12: Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, cleaning up...`);

  if (improvedDb) {
    try {
      await improvedDb.shutdown();
    } catch (error) {
      console.error('Improved persistence shutdown failed:', error);
    }
  }

  if (sqliteDb) {
    try {
      await sqliteDb.flush();
    } catch (error) {
      console.error('SQLite flush failed:', error);
    }
  }

  if (client) {
    client.destroy();
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  process.exit(0);
}
  const exitTimer = setTimeout(() => process.exit(0), 1000);
  if (typeof exitTimer.unref === 'function') {
    exitTimer.unref();
  }
};

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((error) => {
    console.error('SIGTERM shutdown error:', error);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((error) => {
    console.error('SIGINT shutdown error:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error({ error: String(error) }, 'Uncaught exception');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ error: String(reason) }, 'Unhandled rejection');
});

startup().catch((error) => {
  logger.fatal({ error: String(error) }, 'Bot startup failed');
  process.exit(1);
});
