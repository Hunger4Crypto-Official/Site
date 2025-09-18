import { redis } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';

// FIXED: Secure IP allowlist parsing and validation
function parseAllowList(s) {
  if (!s) return [];
  
  const entries = s.split(',').map(x => x.trim()).filter(Boolean);
  const validEntries = [];
  
  for (const entry of entries) {
    // Validate IP/CIDR format
    if (isValidIpPrefix(entry)) {
      validEntries.push(entry);
    } else {
      logger.warn({ invalidEntry: entry }, 'Invalid IP allowlist entry ignored');
    }
  }
  
  return validEntries;
}

// FIXED: Proper IP validation
function isValidIpPrefix(ipPrefix) {
  // Support both individual IPs and CIDR notation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
  
  if (!ipv4Regex.test(ipPrefix) && !ipv6Regex.test(ipPrefix)) {
    return false;
  }
  
  // Additional validation for IPv4
  if (ipv4Regex.test(ipPrefix)) {
    const [ip, cidr] = ipPrefix.split('/');
    const octets = ip.split('.');
    
    // Check each octet is 0-255
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return false;
      }
    }
    
    // Check CIDR is valid (0-32 for IPv4)
    if (cidr) {
      const cidrNum = parseInt(cidr, 10);
      if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) {
        return false;
      }
    }
  }
  
  return true;
}

// FIXED: Secure IP matching with CIDR support
function isIpInAllowlist(clientIp, allowList) {
  if (!allowList || allowList.length === 0) return true;
  
  for (const allowedEntry of allowList) {
    if (matchesIpPrefix(clientIp, allowedEntry)) {
      return true;
    }
  }
  
  return false;
}

// FIXED: Proper CIDR matching instead of simple startsWith
function matchesIpPrefix(clientIp, allowedPrefix) {
  try {
    // Handle exact match first
    if (clientIp === allowedPrefix) {
      return true;
    }
    
    // Handle CIDR notation
    if (allowedPrefix.includes('/')) {
      return isIpInCidr(clientIp, allowedPrefix);
    }
    
    // Handle prefix matching for backward compatibility (but more secure)
    // Only allow if the prefix ends with a dot (subnet boundary)
    if (allowedPrefix.endsWith('.')) {
      return clientIp.startsWith(allowedPrefix);
    }
    
    // Exact IP match only
    return clientIp === allowedPrefix;
  } catch (error) {
    logger.warn({ 
      error: String(error), 
      clientIp: clientIp.slice(0, 10) + '...', 
      allowedPrefix 
    }, 'IP matching error');
    return false;
  }
}

// FIXED: CIDR matching implementation
function isIpInCidr(ip, cidr) {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  if (isNaN(prefix)) return false;
  
  // Convert IPs to integers for bitwise operations
  const ipInt = ipToInt(ip);
  const networkInt = ipToInt(network);
  
  if (ipInt === null || networkInt === null) return false;
  
  // Create subnet mask
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  
  // Check if IP is in the network
  return (ipInt & mask) === (networkInt & mask);
}

function ipToInt(ip) {
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
  } catch (error) {
    return null;
  }
}

function ipFrom(req) {
  // FIXED: More secure IP extraction with validation
  const xf = req.headers['x-forwarded-for'];
  let clientIp = 'unknown';
  
  if (typeof xf === 'string' && xf.length) {
    // Get the first IP from X-Forwarded-For (closest to client)
    const firstIp = xf.split(',')[0].trim();
    
    // Basic validation to prevent header injection
    if (isValidIpFormat(firstIp)) {
      clientIp = firstIp;
    }
  }
  
  // Fallback to direct connection IP
  if (clientIp === 'unknown' && req.socket?.remoteAddress) {
    const remoteIp = req.socket.remoteAddress;
    if (isValidIpFormat(remoteIp)) {
      clientIp = remoteIp;
    }
  }
  
  // Clean up IPv6-mapped IPv4 addresses
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  
  return clientIp;
}

function isValidIpFormat(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Basic IPv4/IPv6 format validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Token bucket keyed by (bucketName, ip)
export function tokenBucket({
  windowMs,
  maxTokens,
  refillPerSec,
  burst,
  bucket = 'global'
}) {
  return async function rateLimit(req, res, next) {
    try {
      const ip = ipFrom(req);
      const key = `rl:${bucket}:${ip}`;
      const now = Date.now();

      // FIXED: Add input validation
      if (ip === 'unknown') {
        logger.warn({ headers: req.headers }, 'Could not determine client IP');
        return res.status(400).json({ ok: false, error: 'invalid_request' });
      }

      const data = await redis.hgetall(key);
      let tokens = Number(data.tokens || maxTokens);
      let ts = Number(data.ts || now);

      const elapsedSec = Math.max(0, (now - ts) / 1000);
      const refill = elapsedSec * refillPerSec;
      tokens = Math.min(maxTokens + burst, tokens + refill);
      
      if (tokens < 1) {
        const retryAfter = Math.ceil((1 - tokens) / refillPerSec);
        res.set('Retry-After', String(retryAfter));
        
        logger.warn({ 
          ip: ip.slice(0, 10) + '...', 
          bucket, 
          tokens: tokens.toFixed(2),
          retryAfter 
        }, 'Rate limit exceeded');
        
        return res.status(429).json({ ok: false, error: 'rate_limited' });
      }
      
      tokens -= 1;

      await redis.hmset(key, { tokens, ts: now });
      await redis.pexpire(key, windowMs);

      // FIXED: Add debug logging for admin requests
      if (bucket === 'admin') {
        logger.debug({ 
          ip: ip.slice(0, 10) + '...', 
          bucket, 
          tokensRemaining: tokens.toFixed(2),
          path: req.path
        }, 'Admin rate limit check passed');
      }

      return next();
    } catch (error) {
      logger.error({ error: String(error), bucket }, 'Rate limiting error');
      return next(); // fail-open on Redis errors
    }
  };
}

export function adminGuard({
  windowMs,
  maxTokens,
  refillPerSec,
  burst,
  allowList = parseAllowList(process.env.ADMIN_IP_ALLOWLIST || '')
}) {
  const rl = tokenBucket({
    windowMs,
    maxTokens,
    refillPerSec,
    burst,
    bucket: 'admin'
  });

  return async function guard(req, res, next) {
    const ip = ipFrom(req);
    
    // FIXED: Secure IP allowlist checking
    if (allowList.length > 0) {
      const allowed = isIpInAllowlist(ip, allowList);
      
      if (!allowed) {
        logger.warn({ 
          ip: ip.slice(0, 10) + '...', 
          allowList: allowList.map(a => a.slice(0, 10) + '...'),
          path: req.path,
          userAgent: req.headers['user-agent']?.slice(0, 50)
        }, 'IP not in admin allowlist');
        
        return res.status(403).json({ ok: false, error: 'forbidden_ip' });
      }
      
      logger.debug({ 
        ip: ip.slice(0, 10) + '...', 
        path: req.path 
      }, 'IP allowlist check passed');
    }
    
    return rl(req, res, next);
  };
}
