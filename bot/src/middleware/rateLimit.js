import { redis } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { config } from '@h4c/shared/config';
import { isValidIpAddress } from '@h4c/shared/utils';

/**
 * SECURITY FIXED: Secure IP allowlist parsing with proper validation
 */
function parseAllowList(allowListString) {
  if (!allowListString || typeof allowListString !== 'string') {
    return [];
  }
  
  const entries = allowListString.split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
    
  const validEntries = [];
  
  for (const entry of entries) {
    // Validate each entry as IP or CIDR
    if (isValidIpOrCidr(entry)) {
      validEntries.push(entry);
    } else {
      logger.warn({ invalidEntry: entry }, 'Invalid IP allowlist entry ignored');
    }
  }
  
  logger.info({ validEntries: validEntries.length }, 'IP allowlist parsed');
  return validEntries;
}

/**
 * SECURITY FIXED: Proper IP/CIDR validation
 */
function isValidIpOrCidr(entry) {
  // Basic IP validation first
  if (isValidIpAddress(entry)) {
    return true;
  }
  
  // CIDR validation
  if (entry.includes('/')) {
    const [ip, cidr] = entry.split('/');
    const cidrNum = parseInt(cidr, 10);
    
    // Validate IP part and CIDR range
    if (!isValidIpAddress(ip)) return false;
    
    // IPv4 CIDR: 0-32, IPv6 CIDR: 0-128
    const isIpv4 = ip.includes('.');
    const maxCidr = isIpv4 ? 32 : 128;
    
    return cidrNum >= 0 && cidrNum <= maxCidr;
  }
  
  return false;
}

/**
 * SECURITY FIXED: Secure IP matching with proper CIDR support
 */
function isIpInAllowlist(clientIp, allowList) {
  if (!Array.isArray(allowList) || allowList.length === 0) {
    return true; // No restrictions
  }
  
  // Validate client IP first
  if (!isValidIpAddress(clientIp)) {
    logger.warn({ clientIp }, 'Invalid client IP format');
    return false;
  }
  
  for (const allowedEntry of allowList) {
    if (typeof allowedEntry !== 'string') continue;
    
    if (matchesIpPattern(clientIp, allowedEntry)) {
      return true;
    }
  }
  
  return false;
}

/**
 * SECURITY FIXED: Proper IP pattern matching
 */
function matchesIpPattern(clientIp, pattern) {
  try {
    // Exact match
    if (clientIp === pattern) {
      return true;
    }
    
    // CIDR matching
    if (pattern.includes('/')) {
      return isIpInCidr(clientIp, pattern);
    }
    
    // Subnet prefix matching (backward compatibility)
    // Only allow if pattern ends with dot (proper subnet boundary)
    if (pattern.endsWith('.') && clientIp.startsWith(pattern)) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.warn({ 
      error: error.message,
      clientIp: clientIp.slice(0, 10) + '...',
      pattern: pattern.slice(0, 10) + '...'
    }, 'IP pattern matching error');
    return false;
  }
}

/**
 * SECURITY FIXED: Proper CIDR matching implementation
 */
function isIpInCidr(ip, cidr) {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  if (isNaN(prefix)) return false;
  
  // Only handle IPv4 CIDR for now
  if (!network.includes('.') || !ip.includes('.')) {
    return false;
  }
  
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  
  if (ipInt === null || networkInt === null) return false;
  
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function ipv4ToInt(ip) {
  try {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    
    let result = 0;
    for (let i = 0; i < 4; i++) {
      const part = parseInt(parts[i], 10);
      if (isNaN(part) || part < 0 || part > 255) return null;
      result = (result << 8) + part;
    }
    return result >>> 0; // Ensure unsigned 32-bit
  } catch {
    return null;
  }
}

/**
 * SECURITY FIXED: Secure client IP extraction with validation
 */
function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  let clientIp = 'unknown';
  
  // Extract from X-Forwarded-For header (first IP is client)
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0 && xForwardedFor.length < 100) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (isValidIpAddress(firstIp)) {
      clientIp = firstIp;
    }
  }
  
  // Fallback to direct connection IP
  if (clientIp === 'unknown' && req.socket?.remoteAddress) {
    const remoteIp = req.socket.remoteAddress;
    if (isValidIpAddress(remoteIp)) {
      // Clean up IPv6-mapped IPv4 addresses
      clientIp = remoteIp.startsWith('::ffff:') ? remoteIp.substring(7) : remoteIp;
    }
  }
  
  return clientIp;
}

/**
 * Token bucket rate limiter with Redis backend
 */
export function tokenBucket(options = {}) {
  const {
    windowMs = config.security.rateLimits.public.windowMs,
    maxTokens = config.security.rateLimits.public.max,
    refillPerSec = 2,
    burst = 20,
    bucket = 'global'
  } = options;

  return async function rateLimit(req, res, next) {
    const clientIp = getClientIp(req);
    
    // Security check: reject if we can't determine IP
    if (clientIp === 'unknown') {
      logger.warn({ 
        headers: Object.keys(req.headers),
        hasSocket: !!req.socket 
      }, 'Could not determine client IP for rate limiting');
      return res.status(400).json({ 
        ok: false, 
        error: 'Unable to process request' 
      });
    }

    const key = `rl:${bucket}:${clientIp}`;
    const now = Date.now();

    try {
      // Get current bucket state
      const data = await redis.hgetall(key);
      let tokens = Number(data.tokens || maxTokens);
      let lastRefill = Number(data.ts || now);

      // Calculate token refill
      const elapsedSec = Math.max(0, (now - lastRefill) / 1000);
      const refillAmount = elapsedSec * refillPerSec;
      tokens = Math.min(maxTokens + burst, tokens + refillAmount);
      
      // Check if request can proceed
      if (tokens < 1) {
        const retryAfter = Math.ceil((1 - tokens) / refillPerSec);
        
        res.set('Retry-After', String(retryAfter));
        res.set('X-RateLimit-Limit', String(maxTokens));
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', String(Math.ceil((now + (retryAfter * 1000)) / 1000)));
        
        logger.warn({ 
          ip: clientIp.slice(0, 10) + '...', 
          bucket, 
          tokens: tokens.toFixed(2),
          retryAfter 
        }, 'Rate limit exceeded');
        
        return res.status(429).json({ 
          ok: false, 
          error: 'Rate limit exceeded',
          retryAfter 
        });
      }
      
      // Consume token
      tokens -= 1;

      // Update bucket state
      await redis.hmset(key, { 
        tokens: tokens.toFixed(6), 
        ts: now 
      });
      await redis.pexpire(key, windowMs);

      // Add rate limit headers
      res.set('X-RateLimit-Limit', String(maxTokens));
      res.set('X-RateLimit-Remaining', String(Math.floor(tokens)));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      logger.debug({ 
        ip: clientIp.slice(0, 10) + '...', 
        bucket, 
        tokensRemaining: tokens.toFixed(2)
      }, 'Rate limit check passed');

      return next();
      
    } catch (error) {
      logger.error({ 
        error: error.message, 
        bucket,
        ip: clientIp.slice(0, 10) + '...'
      }, 'Rate limiting error - failing open');
      
      // Fail open on Redis errors to maintain availability
      return next();
    }
  };
}

/**
 * Admin-only rate limiter with IP allowlist
 */
export function adminGuard(options = {}) {
  const {
    windowMs = config.security.rateLimits.admin.windowMs,
    maxTokens = config.security.rateLimits.admin.max,
    refillPerSec = 1,
    burst = 5,
    allowList = parseAllowList(process.env.ADMIN_IP_ALLOWLIST || '')
  } = options;

  const rateLimiter = tokenBucket({
    windowMs,
    maxTokens,
    refillPerSec,
    burst,
    bucket: 'admin'
  });

  return async function adminRateLimit(req, res, next) {
    const clientIp = getClientIp(req);
    
    // IP allowlist check
    if (allowList.length > 0) {
      const allowed = isIpInAllowlist(clientIp, allowList);
      
      if (!allowed) {
        logger.warn({ 
          ip: clientIp.slice(0, 10) + '...', 
          path: req.path,
          userAgent: req.headers['user-agent']?.slice(0, 50),
          allowListSize: allowList.length
        }, 'Admin access denied - IP not in allowlist');
        
        return res.status(403).json({ 
          ok: false, 
          error: 'Access denied' 
        });
      }
      
      logger.debug({ 
        ip: clientIp.slice(0, 10) + '...', 
        path: req.path 
      }, 'Admin IP allowlist check passed');
    }
    
    // Apply rate limiting
    return rateLimiter(req, res, next);
  };
}

/**
 * Get rate limit statistics for monitoring
 */
export async function getRateLimitStats() {
  try {
    const keys = await redis.keys('rl:*');
    const stats = {
      totalBuckets: keys.length,
      bucketsByType: {},
      timestamp: Date.now()
    };
    
    // Count buckets by type
    for (const key of keys) {
      const [, bucketType] = key.split(':');
      stats.bucketsByType[bucketType] = (stats.bucketsByType[bucketType] || 0) + 1;
    }
    
    return stats;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get rate limit stats');
    return { error: error.message };
  }
}

/**
 * Clear all rate limit buckets (admin utility)
 */
export async function clearRateLimits() {
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(keys);
      logger.info({ cleared: keys.length }, 'Rate limit buckets cleared');
    }
    return { cleared: keys.length };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to clear rate limits');
    throw error;
  }
}
