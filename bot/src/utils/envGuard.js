// Environment validation and type-safe access
import { logger } from './logger.js';

class EnvironmentGuard {
  constructor() {
    this.validateRequired();
  }

  // Required environment variables
  get MONGODB_URI() { return process.env.MONGODB_URI; }
  get REDIS_URL() { return process.env.REDIS_URL; }
  get BOT_TOKEN() { return process.env.BOT_TOKEN; }
  get DISCORD_GUILD_ID() { return process.env.DISCORD_GUILD_ID; }
  get ADMIN_JWT_SECRET() { return process.env.ADMIN_JWT_SECRET; }
  get ALGORAND_NODE_URL() { return process.env.ALGORAND_NODE_URL; }

  // Optional with defaults
  get NODELY_INDEXER_URL() { 
    return process.env.NODELY_INDEXER_URL || 'https://mainnet-api.4160.nodely.dev'; 
  }
  get TINYMAN_API() {
    return process.env.TINYMAN_API || 'https://mainnet.analytics.tinyman.org/api/v1';
  }

  // Configuration with defaults
  get ALG_BALANCE_TTL_MS() { return Number(process.env.ALG_BALANCE_TTL_MS || '60000'); }
  get ALGORAND_BALANCE_TTL_MS() { return this.ALG_BALANCE_TTL_MS; } // alias
  
  get BUCKETS() { return Number(process.env.BUCKETS || '10'); }
  get BUCKET_PERIOD_MIN() { return Number(process.env.BUCKET_PERIOD_MIN || '5'); }
  get SCAN_CONCURRENCY() { return Number(process.env.SCAN_CONCURRENCY || '3'); }
  get SCAN_SPACING_MS() { return Number(process.env.SCAN_SPACING_MS || '1000'); }
  get GLOBAL_CALL_BUDGET_5M() { return Number(process.env.GLOBAL_CALL_BUDGET_5M || '300'); }

  // Rate limiting defaults
  get RATE_LIMIT_WINDOW_MS() { return Number(process.env.RATE_LIMIT_WINDOW_MS || '60000'); }
  get RATE_LIMIT_MAX_TOKENS() { return Number(process.env.RATE_LIMIT_MAX_TOKENS || '120'); }
  get RATE_LIMIT_REFILL_PER_SEC() { return Number(process.env.RATE_LIMIT_REFILL_PER_SEC || '2'); }
  get RATE_LIMIT_BURST() { return Number(process.env.RATE_LIMIT_BURST || '20'); }

  validateRequired() {
    const required = [
      'MONGODB_URI', 'REDIS_URL', 'BOT_TOKEN', 'DISCORD_GUILD_ID', 
      'ADMIN_JWT_SECRET', 'ALGORAND_NODE_URL'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      logger.error({ missing }, 'Missing required environment variables');
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

// Create singleton instance
export const Env = new EnvironmentGuard();

// Validation helper functions
export function assertRequiredEnv(keys) {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function assertStrongSecret(key, minLength = 32) {
  const value = process.env[key];
  if (!value || value.length < minLength) {
    throw new Error(`${key} must be at least ${minLength} characters long`);
  }
}

export function assertUrlNoV2(key) {
  const value = process.env[key];
  if (value && value.includes('/v2/')) {
    logger.warn({ key, value }, 'URL contains /v2/ which may cause issues');
  }
}
