import { redis } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemoryItems = 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
    
    // Clean up memory cache periodically
    setInterval(() => this.cleanupMemoryCache(), 60000); // Every minute
  }
  
  async get(key, options = {}) {
    const { useMemory = true, ttl = 300 } = options;
    
    try {
      // L1: Memory cache
      if (useMemory && this.memoryCache.has(key)) {
        const item = this.memoryCache.get(key);
        if (Date.now() < item.expires) {
          this.stats.hits++;
          logger.debug({ key, source: 'memory' }, 'Cache hit');
          return item.value;
        }
        this.memoryCache.delete(key);
      }
      
      // L2: Redis cache
      const cached = await redis.get(key);
      if (cached) {
        const value = JSON.parse(cached);
        this.stats.hits++;
        logger.debug({ key, source: 'redis' }, 'Cache hit');
        
        // Store in memory cache for faster access
        if (useMemory) {
          this.setMemory(key, value, Math.min(ttl, 60)); // Max 1min in memory
        }
        
        return value;
      }
      
      this.stats.misses++;
      logger.debug({ key }, 'Cache miss');
      return null;
      
    } catch (error) {
      this.stats.errors++;
      logger.warn({ error: error.message, key }, 'Cache get error');
      return null;
    }
  }
  
  async set(key, value, ttl = 300, options = {}) {
    const { useMemory = true } = options;
    
    try {
      // Store in Redis
      await redis.setex(key, ttl, JSON.stringify(value));
      
      // Store in memory cache
      if (useMemory) {
        this.setMemory(key, value, Math.min(ttl, 60));
      }
      
      this.stats.sets++;
      logger.debug({ key, ttl }, 'Cache set');
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error: error.message, key }, 'Cache set error');
      throw error;
    }
  }
  
  setMemory(key, value, ttl) {
    // Evict oldest items if at capacity
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000),
      created: Date.now()
    });
  }
  
  async invalidate(pattern) {
    try {
      // Clear memory cache
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      } else {
        this.memoryCache.delete(pattern);
      }
      
      // Clear Redis cache
      if (pattern.includes('*')) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      } else {
        await redis.del(pattern);
      }
      
      logger.debug({ pattern }, 'Cache invalidated');
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error: error.message, pattern }, 'Cache invalidation error');
      throw error;
    }
  }
  
  cleanupMemoryCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (now >= item.expires) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug({ cleaned, remaining: this.memoryCache.size }, 'Memory cache cleanup');
    }
  }
  
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
      
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memoryItems: this.memoryCache.size,
      memoryCapacity: this.maxMemoryItems
    };
  }
  
  async healthCheck() {
    try {
      const testKey = 'health:cache:test';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get(testKey);
      await this.invalidate(testKey);
      
      return {
        healthy: retrieved && retrieved.timestamp === testValue.timestamp,
        stats: this.getStats()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        stats: this.getStats()
      };
    }
  }
}

export const cache = new CacheManager();
