import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const redis = new Redis(config.redis.url, {
  connectTimeout: 10_000,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    logger.warn({ attempt: times, delay }, 'Redis reconnect attempt');
    return delay;
  }
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error: String(error) }, 'Redis connection error');
});

redis.on('end', () => {
  logger.warn('Redis connection ended');
});

export { redis };

export async function getRedisHealth() {
  try {
    const start = Date.now();
    const pong = await redis.ping();
    return {
      healthy: pong === 'PONG',
      latencyMs: Date.now() - start,
      status: redis.status
    };
  } catch (error) {
    return {
      healthy: false,
      error: String(error),
      status: redis.status
    };
  }
}

export async function closeRedis() {
  try {
    await redis.quit();
  } catch (error) {
    logger.warn({ error: String(error) }, 'Redis quit failed, forcing disconnect');
    redis.disconnect();
  }
}
