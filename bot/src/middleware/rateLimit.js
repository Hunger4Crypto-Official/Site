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

  return async function rateLimit(
  
