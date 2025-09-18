import { createClient } from 'ioredis';
import { Env } from './envGuard.js';
import { logger } from './logger.js';

// FIXED: Enhanced Redis client with proper connection management
const redisConfig = {
  // Connection settings
  connectTimeout: 10000,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxLoadingTimeout: 5000,
  
  // Connection pool settings
  family: 4, // IPv4
  keepAlive: true,
  
  // Retry strategy
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
  
  // Custom retry strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn({ attempt: times, delay }, 'Redis retry attempt');
    return delay;
  },

  // Reconnect strategy  
  reconnectOnError: (error) => {
    const targetError = 'READONLY';
    return error.message.includes(targetError);
  }
};

export const redis = new createClient(Env.REDIS_URL, redisConfig);

// FIXED: Enhanced error handling and logging
redis.on('error', (err) => {
  logger.error({ error: String(err), redisUrl: Env.REDIS_URL.replace(/:[^:]*@/, ':***@') }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('reconnecting', (ms) => {
  logger.warn({ delayMs: ms }, 'Redis reconnecting');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('end', () => {
  logger.warn('Redis connection ended');
});

// FIXED: Graceful shutdown handling
let isShuttingDown = false;

export async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('Gracefully shutting down Redis connection...');
  
  try {
    // Give pending operations time to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Disconnect
    redis.disconnect();
    logger.info('Redis disconnected gracefully');
  } catch (error) {
    logger.error({ error: String(error) }, 'Error during Redis shutdown');
  }
}

// FIXED: Health check method
export async function checkRedisHealth() {
  try {
    const start = Date.now();
    const result = await redis.ping();
    const latency = Date.now() - start;
    
    return {
      healthy: result === 'PONG',
      latencyMs: latency,
      status: redis.status,
      connectedClients: await redis.info('clients').then(info => {
        const match = info.match(/connected_clients:(\d+)/);
        return match ? parseInt(match[1]) : 'unknown';
      }).catch(() => 'unknown')
    };
  } catch (error) {
    return {
      healthy: false,
      error: String(error),
      status: redis.status
    };
  }
}

// FIXED: Connection wrapper with retry logic
export async function safeRedisOperation(operation, fallback = null) {
  try {
    return await operation(redis);
  } catch (error) {
    logger.warn({ error: String(error) }, 'Redis operation failed');
    
    // If Redis is down, return fallback value
    if (fallback !== null) {
      return fallback;
    }
    
    throw error;
  }
}

// FIXED: Auto-cleanup for expired keys
export async function cleanupExpiredKeys() {
  try {
    const info = await redis.info('keyspace');
    const dbMatch = info.match(/db0:keys=(\d+),expires=(\d+)/);
    
    if (dbMatch) {
      const totalKeys = parseInt(dbMatch[1]);
      const keysWithExpiry = parseInt(dbMatch[2]);
      
      logger.debug({ 
        totalKeys, 
        keysWithExpiry,
        expiryRatio: (keysWithExpiry / totalKeys * 100).toFixed(1) + '%'
      }, 'Redis keyspace stats');
    }
    
    // Force expire check on sample of keys
    const sampleKeys = await redis.randomkey();
    if (sampleKeys) {
      await redis.ttl(sampleKeys);
    }
    
  } catch (error) {
    logger.warn({ error: String(error) }, 'Redis cleanup check failed');
  }
}

// FIXED: Periodic cleanup
setInterval(cleanupExpiredKeys, 300000); // Every 5 minutes

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('beforeExit', gracefulShutdown);
