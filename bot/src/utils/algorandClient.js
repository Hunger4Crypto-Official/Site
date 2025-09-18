import fetch from 'node-fetch';
import { redis } from './redisClient.js';
import { Env } from './envGuard.js';
import { budgeted } from './rate.js';
import { metricsRecordIndexer } from '../middleware/metrics.js';
import { logger } from './logger.js';

const BASE = (process.env.NODELY_INDEXER_URL || 'https://mainnet-api.4160.nodely.dev').replace(/\/+$/, '');
const API_KEY = process.env.NODELY_INDEXER_API_KEY || null;
const TTL_MS = Env.ALGORAND_BALANCE_TTL_MS || Env.ALG_BALANCE_TTL_MS || 60000;

// FIXED: Enhanced error handling and retry logic
async function idxGet(path, qs = {}) {
  const url = new URL(`${BASE}/v2${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(qs).forEach(([k, v]) => (v !== undefined && v !== null) && url.searchParams.set(k, String(v)));
  
  const headers = { 
    accept: 'application/json',
    'User-Agent': 'H4C-Bot/1.0'
  };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  let lastError;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url.toString(), { 
        headers, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      metricsRecordIndexer(res.ok, res.status);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const error = new Error(`HTTP_${res.status}:${txt.slice(0,120)}`);
        
        // Don't retry on client errors (4xx), but do retry on server errors (5xx)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw error;
        }
        
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          logger.warn({ 
            attempt, 
            status: res.status, 
            delay, 
            url: url.pathname 
          }, 'Algorand API retry');
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        throw error;
      }

      return await res.json();
    } catch (error) {
      lastError = error;
      metricsRecordIndexer(false, 0);
      
      if (error.name === 'AbortError') {
        logger.warn({ attempt, url: url.pathname }, 'Algorand API timeout');
      } else {
        logger.warn({ 
          attempt, 
          error: String(error), 
          url: url.pathname 
        }, 'Algorand API error');
      }
      
      if (attempt < maxRetries && !error.name?.includes('AbortError')) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('HTTP_UNREACHABLE');
}

// FIXED: Better cache management and error handling
async function readAssetBalance(address, asaId) {
  try {
    const data = await budgeted(() => idxGet(`/accounts/${address}`));
    
    if (!data?.account) {
      logger.warn({ address: address.slice(0, 8) + '...', asaId }, 'Account not found');
      return 0;
    }

    const assets = data.account.assets || [];
    const match = assets.find(a => Number(a['asset-id']) === Number(asaId));
    const balance = match?.amount ? Number(match.amount) : 0;
    
    logger.debug({ 
      address: address.slice(0, 8) + '...', 
      asaId, 
      balance,
      hasAsset: !!match
    }, 'Balance retrieved');
    
    return balance;
  } catch (error) {
    logger.error({ 
      error: String(error), 
      address: address.slice(0, 8) + '...', 
      asaId 
    }, 'Balance fetch failed');
    throw error;
  }
}

export const algoClient = {
  async getAssetBalance(address, asaId) {
    const key = `algo:bal:${address}:${asaId}`;
    
    try {
      // FIXED: Better cache handling with error recovery
      const cached = await redis.hgetall(key);
      const now = Date.now();
      
      if (cached?.amount && cached.ts && (now - Number(cached.ts)) < TTL_MS) {
        logger.debug({ 
          address: address.slice(0, 8) + '...', 
          asaId,
          cacheAge: now - Number(cached.ts)
        }, 'Using cached balance');
        return Number(cached.amount);
      }

      // Cache miss or expired, fetch fresh data
      let amount;
      let shouldCache = true;
      
      try {
        amount = await readAssetBalance(address, asaId);
      } catch (error) {
        // FIXED: On error, use cached value if available, even if stale
        if (cached?.amount) {
          logger.warn({ 
            error: String(error),
            address: address.slice(0, 8) + '...', 
            asaId,
            cacheAge: now - Number(cached.ts)
          }, 'Using stale cached balance due to API error');
          
          // Extend cache TTL slightly to avoid immediate retry
          await redis.hset(key, { 
            amount: cached.amount, 
            ts: now - (TTL_MS / 2) // Half TTL to retry sooner
          });
          await redis.expire(key, Math.ceil(TTL_MS / 1000));
          
          return Number(cached.amount);
        }
        
        // No cached value available, return 0 but don't cache the error
        logger.error({ 
          error: String(error),
          address: address.slice(0, 8) + '...', 
          asaId 
        }, 'Balance fetch failed with no cache fallback');
        shouldCache = false;
        amount = 0;
      }

      // FIXED: Cache successful results and valid zeros
      if (shouldCache) {
        try {
          await redis.hset(key, { amount: amount, ts: now });
          await redis.expire(key, Math.ceil(TTL_MS / 1000));
        } catch (cacheError) {
          logger.warn({ 
            error: String(cacheError),
            address: address.slice(0, 8) + '...'
          }, 'Failed to cache balance');
          // Don't fail the request if caching fails
        }
      }

      return amount;
    } catch (error) {
      logger.error({ 
        error: String(error),
        address: address.slice(0, 8) + '...', 
        asaId 
      }, 'getAssetBalance failed');
      
      // Last resort: try to get any cached value, even very stale
      try {
        const cached = await redis.hgetall(key);
        if (cached?.amount) {
          logger.warn({ 
            address: address.slice(0, 8) + '...',
            asaId
          }, 'Using emergency stale cache');
          return Number(cached.amount);
        }
      } catch (cacheError) {
        logger.error({ error: String(cacheError) }, 'Emergency cache lookup failed');
      }
      
      // Absolute fallback
      return 0;
    }
  },

  // FIXED: Add cache warming and management methods
  async warmCache(addresses, asaIds) {
    logger.info({ 
      addressCount: addresses.length, 
      asaIds 
    }, 'Starting cache warm-up');
    
    const errors = [];
    let warmed = 0;
    
    for (const address of addresses) {
      for (const asaId of asaIds) {
        try {
          await this.getAssetBalance(address, asaId);
          warmed++;
        } catch (error) {
          errors.push({ address: address.slice(0, 8) + '...', asaId, error: String(error) });
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    logger.info({ 
      warmed, 
      errors: errors.length,
      sampleErrors: errors.slice(0, 3)
    }, 'Cache warm-up complete');
    
    return { warmed, errors };
  },

  async clearCache(address, asaId) {
    const key = `algo:bal:${address}:${asaId}`;
    try {
      await redis.del(key);
      logger.debug({ address: address.slice(0, 8) + '...', asaId }, 'Cache cleared');
    } catch (error) {
      logger.warn({ error: String(error) }, 'Cache clear failed');
    }
  },

  async getCacheStats() {
    try {
      const keys = await redis.keys('algo:bal:*');
      const stats = {
        totalKeys: keys.length,
        sampleKeys: keys.slice(0, 5),
        memoryUsage: await redis.memory('usage').catch(() => 'unknown')
      };
      
      return stats;
    } catch (error) {
      logger.warn({ error: String(error) }, 'Cache stats failed');
      return { error: String(error) };
    }
  }
};
