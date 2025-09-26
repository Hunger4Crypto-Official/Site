// MEMORY OPTIMIZATION FIXES - Add these at the top of bot/src/index.js

import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

// MEMORY FIX 1: Limit Node.js memory usage
if (process.env.NODE_OPTIONS !== '--max-old-space-size=512') {
  console.log('Setting memory limit to 512MB');
  process.env.NODE_OPTIONS = '--max-old-space-size=512';
}

// MEMORY FIX 2: Aggressive garbage collection
if (global.gc) {
  console.log('Manual GC enabled');
  setInterval(() => {
    global.gc();
  }, 30000); // Every 30 seconds
}

// MEMORY FIX 3: Lazy load heavy modules
let slashCommands = null;
let botResponses = null;

async function loadBotResponses() {
  if (!botResponses) {
    // Only load what we need, when we need it
    const { gmResponses, cryptoJokes, techFacts } = await import('./utils/botResponses.js');
    botResponses = { gmResponses, cryptoJokes, techFacts };
  }
  return botResponses;
}

// MEMORY FIX 4: Connection pool limits
const mongooseOptions = {
  maxPoolSize: 2,  // Reduced from 10
  minPoolSize: 1,   // Reduced from 2
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  bufferCommands: false,
  autoIndex: false  // Don't build indexes automatically
};

// MEMORY FIX 5: Simplified Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel],
  // Memory optimizations
  ws: {
    large_threshold: 50,  // Reduced from default 250
    compress: true
  },
  makeCache: {
    // Limit cache sizes
    MessageManager: 10,   // Only cache 10 messages per channel
    PresenceManager: 0,   // Don't cache presences
    GuildMemberManager: 50,  // Only cache 50 members
    UserManager: 50      // Only cache 50 users
  },
  sweepers: {
    messages: {
      interval: 3600, // Every hour
      lifetime: 1800, // 30 minutes
    }
  }
});

// MEMORY FIX 6: Prevent memory leaks from event listeners
const maxListeners = 10;
client.setMaxListeners(maxListeners);
process.setMaxListeners(maxListeners);

// MEMORY FIX 7: Simplified express app
const app = express();
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb

// MEMORY FIX 8: Basic health check only
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    ok: true,
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    },
    uptime: process.uptime()
  });
});

// MEMORY FIX 9: Simplified database connection
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log('MongoDB connected with reduced pool');
    
    // Clean up old connections periodically
    setInterval(async () => {
      try {
        await mongoose.connection.db.admin().ping();
      } catch (error) {
        console.error('MongoDB ping failed:', error.message);
      }
    }, 60000); // Every minute
    
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    // Don't throw - let the app run without DB if needed
  }
}

// MEMORY FIX 10: Minimal Discord functionality
client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
  console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  // Don't load slash commands immediately
  setTimeout(async () => {
    try {
      const { loadSlashCommands } = await import('./slash/loader.js');
      await loadSlashCommands(client);
    } catch (error) {
      console.error('Slash commands failed to load:', error.message);
    }
  }, 5000);
});

// MEMORY FIX 11: Simplified message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  
  const content = message.content?.toLowerCase();
  if (!content) return;
  
  // Only respond to specific keywords to save memory
  if (content === 'gm' || content === 'good morning') {
    await message.reply('GM! ☀️');
  } else if (content === 'gn' || content === 'good night') {
    await message.reply('GN! 🌙');
  }
});

// MEMORY FIX 12: Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up...');
  
  if (client) {
    client.destroy();
  }
  
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  
  process.exit(0);
});

// MEMORY FIX 13: Error handling without memory leaks
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  // Don't exit - try to recover
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  // Don't exit - try to recover
});

// MEMORY FIX 14: Simple startup
async function startup() {
  console.log('Starting bot with memory optimizations...');
  
  // Connect to MongoDB (non-blocking)
  connectDatabase().catch(console.error);
  
  // Start Discord bot
  await client.login(process.env.BOT_TOKEN);
  
  // Start HTTP server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`HTTP server on port ${PORT}`);
    console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
}

// Start the bot
startup().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
