import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto'; // ✅ Built into Node.js

// Enhanced rate limiting with all security features
class SecurityRateLimiter {
  private store = new Map<string, { 
    count: number; 
    resetTime: number; 
    attempts: number;
    blocked: boolean;
    blockUntil?: number;
  }>();
  
  private readonly maxAttempts = 5;
  private readonly windowMs = 60000; // 1 minute
  private readonly blockDurationMs = 300000; // 5 minutes
  private readonly maxEmailAttempts = 3; // Per email per hour

  isAllowed(ip: string, email?: string): { 
    allowed: boolean; 
    retryAfter?: number; 
    reason?: string;
    remaining?: number;
  } {
    const now = Date.now();
    
    // Check IP-based rate limiting
    const ipResult = this.checkIpLimit(ip, now);
    if (!ipResult.allowed) return ipResult;
    
    // Check email-based rate limiting if email provided
    if (email) {
      const emailResult = this.checkEmailLimit(email, now);
      if (!emailResult.allowed) return emailResult;
    }
    
    return { allowed: true, remaining: this.maxAttempts - ipResult.count };
  }
  
  private checkIpLimit(ip: string, now: number) {
    let record = this.store.get(ip);
    
    // Clean up expired records
    if (record && now > record.resetTime && !record.blocked) {
      this.store.delete(ip);
      record = undefined;
    }
    
    // Check if IP is blocked
    if (record?.blocked && record.blockUntil && now < record.blockUntil) {
      return { 
        allowed: false, 
        retryAfter: Math.ceil((record.blockUntil - now) / 1000),
        reason: 'IP temporarily blocked due to suspicious activity'
      };
    }
    
    if (!record) {
      this.store.set(ip, { 
        count: 1, 
        resetTime: now + this.windowMs, 
        attempts: 1,
        blocked: false
      });
      return { allowed: true, count: 1 };
    }
    
    // Unblock if block period expired
    if (record.blocked && record.blockUntil && now >= record.blockUntil) {
      record.blocked = false;
      record.count = 1;
      record.attempts = 1;
      record.resetTime = now + this.windowMs;
      delete record.blockUntil;
      return { allowed: true, count: 1 };
    }
    
    if (record.count >= this.maxAttempts) {
      // Block the IP
      record.blocked = true;
      record.blockUntil = now + this.blockDurationMs;
      record.attempts++;
      
      return { 
        allowed: false, 
        retryAfter: Math.ceil(this.blockDurationMs / 1000),
        reason: 'Rate limit exceeded. IP blocked.'
      };
    }
    
    record.count++;
    return { allowed: true, count: record.count };
  }
  
  private checkEmailLimit(email: string, now: number) {
    const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 16);
    const emailKey = `email:${emailHash}`;
    
    let record = this.store.get(emailKey);
    const emailWindowMs = 3600000; // 1 hour for email limits
    
    if (!record || now > record.resetTime) {
      this.store.set(emailKey, { 
        count: 1, 
        resetTime: now + emailWindowMs, 
        attempts: 1,
        blocked: false
      });
      return { allowed: true, count: 1 };
    }
    
    if (record.count >= this.maxEmailAttempts) {
      return { 
        allowed: false, 
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        reason: 'Too many subscription attempts for this email address'
      };
    }
    
    record.count++;
    return { allowed: true, count: record.count };
  }
  
  // Clean up old entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      const isExpired = now > record.resetTime + this.blockDurationMs;
      if (isExpired && !record.blocked) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimiter = new SecurityRateLimiter();

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 300000);

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket.remoteAddress || 'unknown';
  
  // Validate IP format and block suspicious IPs
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip !== 'unknown') {
    return 'unknown';
  }
  
  // Block obviously malicious IPs
  const blockedPrefixes = ['0.', '127.', '169.254.', '224.', '240.'];
  if (blockedPrefixes.some(prefix => ip.startsWith(prefix))) {
    return 'blocked';
  }
  
  return ip;
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  // Enhanced email validation with security checks
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email address too long' };
  }
  
  // Security: Check for injection attempts
  const suspiciousPatterns = [
    /<[^>]*>/,        // HTML tags
    /javascript:/i,   // JavaScript URLs
    /data:/i,         // Data URLs
    /['"\\]/,        // Quotes and backslashes
    /[{}]/,          // Curly braces
    /%[0-9a-f]{2}/i, // URL encoding
    /\x00-\x1f/,     // Control characters
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return { valid: false, error: 'Email contains invalid characters' };
  }
  
  // Block disposable/temporary email providers
  const disposableDomains = [
    // Common disposable providers
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'trashmail.com', 'yopmail.com',
    'temp-mail.org', 'mohmal.com', 'throwaway.email',
    'getnada.com', 'maildrop.cc', 'tempmailaddress.com',
    
    // Additional suspicious domains
    'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'bccto.me', 'chacuo.net', 'mytrashmail.com'
  ];
  
  const domain = email.toLowerCase().split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Temporary email addresses are not allowed' };
  }
  
  // Additional domain validation
  if (domain.length < 3 || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, error: 'Invalid email domain' };
  }
  
  return { valid: true };
}

// Circuit breaker for bot API with exponential backoff
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly baseTimeout = 60000; // 1 minute
  private readonly maxTimeout = 300000; // 5 minutes

  canAttempt(): boolean {
    if (this.failures < this.threshold) return true;
    
    const backoffTime = Math.min(
      this.baseTimeout * Math.pow(2, this.failures - this.threshold), 
      this.maxTimeout
    );
    
    return Date.now() - this.lastFailure > backoffTime;
  }
  
  recordSuccess(): void {
    this.failures = 0;
  }
  
  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }
  
  getStatus() {
    return {
      failures: this.failures,
      isOpen: this.failures >= this.threshold,
      canAttempt: this.canAttempt()
    };
  }
}

const botApiCircuitBreaker = new CircuitBreaker();

async function notifyBotApi(email: string, clientIp: string, userAgent: string): Promise<boolean> {
  const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_JWT_SECRET;

  if (!adminSecret || !botApiCircuitBreaker.canAttempt()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${botApiUrl}/api/email/web-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`,
        'User-Agent': 'H4C-Web-Service/1.0',
        'X-Forwarded-For': clientIp
      },
      body: JSON.stringify({ 
        email,
        source: 'web',
        userAgent: userAgent.slice(0, 200), // Limit length
        ip: clientIp,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      botApiCircuitBreaker.recordSuccess();
      return true;
    } else {
      botApiCircuitBreaker.recordFailure();
      return false;
    }
  } catch (error) {
    botApiCircuitBreaker.recordFailure();
    return false;
  }
}

// Request size limiter
function validateRequestSize(req: NextApiRequest): boolean {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 1024) { // 1KB limit
    return false;
  }
  return true;
}

// CSRF protection for API routes
function validateOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Allow same-origin requests
  if (origin && origin.includes(host!)) return true;
  if (referer && referer.includes(host!)) return true;
  
  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate request size
  if (!validateRequestSize(req)) {
    return res.status(413).json({ error: 'Request too large' });
  }

  // CSRF protection
  if (!validateOrigin(req)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  const clientIp = getClientIp(req);
  
  // Block malicious IPs
  if (clientIp === 'blocked') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const { email } = req.body;
    
    // Validate email with all security checks
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Enhanced rate limiting (IP + email)
    const rateLimitResult = rateLimiter.isAllowed(clientIp, cleanEmail);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ 
        error: rateLimitResult.reason || 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Security logging (anonymized)
    const logData = {
      timestamp: new Date().toISOString(),
      ip: clientIp.slice(0, -2) + 'xx', // Anonymize last 2 digits
      emailDomain: cleanEmail.split('@')[1],
      userAgent: req.headers['user-agent']?.slice(0, 50) || 'unknown',
      remaining: rateLimitResult.remaining
    };
    console.log('Email subscription attempt:', logData);

    // Notify bot API (non-blocking, with circuit breaker)
    const userAgent = req.headers['user-agent'] || '';
    notifyBotApi(cleanEmail, clientIp, userAgent).catch(err => 
      console.warn('Bot API notification failed:', err.message)
    );

    // Always return success to prevent email enumeration
    return res.status(200).json({ 
      success: true, 
      message: 'Thank you for subscribing! Please check your email for confirmation.',
      // Development debugging info (remove in production)
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          rateLimitRemaining: rateLimitResult.remaining,
          circuitBreakerStatus: botApiCircuitBreaker.getStatus()
        }
      })
    });

  } catch (error) {
    console.error('Email subscription error:', error);
    return res.status(500).json({ 
      error: 'Something went wrong. Please try again later.' 
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1kb', // Reduced for security
    },
  },
}
