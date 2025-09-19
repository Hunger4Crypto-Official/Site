import type { NextApiRequest, NextApiResponse } from 'next';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createHash } from 'crypto';

// Enhanced rate limiting with Redis-like behavior
class SecurityRateLimiter {
  private store = new Map<string, { count: number; resetTime: number; attempts: number }>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60000; // 1 minute
  private readonly blockDurationMs = 300000; // 5 minutes

  isAllowed(ip: string, email?: string): { allowed: boolean; retryAfter?: number; reason?: string } {
    const now = Date.now();
    const key = email ? createHash('sha256').update(email).digest('hex').slice(0, 16) : ip;
    
    let record = this.store.get(key);
    
    // Clean up expired records
    if (record && now > record.resetTime) {
      this.store.delete(key);
      record = undefined;
    }
    
    if (!record) {
      this.store.set(key, { count: 1, resetTime: now + this.windowMs, attempts: 1 });
      return { allowed: true };
    }
    
    // Check if IP is temporarily blocked
    if (record.attempts >= this.maxAttempts) {
      const blockEndTime = record.resetTime + this.blockDurationMs;
      if (now < blockEndTime) {
        return { 
          allowed: false, 
          retryAfter: Math.ceil((blockEndTime - now) / 1000),
          reason: 'Too many attempts. IP temporarily blocked.'
        };
      } else {
        // Unblock and reset
        record.attempts = 1;
        record.count = 1;
        record.resetTime = now + this.windowMs;
      }
    }
    
    if (record.count >= this.maxAttempts) {
      record.attempts++;
      return { 
        allowed: false, 
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        reason: 'Rate limit exceeded'
      };
    }
    
    record.count++;
    return { allowed: true };
  }
  
  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime + this.blockDurationMs) {
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
  
  // Validate IP format
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip !== 'unknown') {
    return 'unknown';
  }
  
  return ip;
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  // Enhanced email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email address too long' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /[<>]/,           // HTML brackets
    /javascript:/i,   // JavaScript URLs
    /data:/i,         // Data URLs
    /['"]/,          // Quotes (potential injection)
    /[{}]/,          // Curly braces
    /\\/,            // Backslashes
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return { valid: false, error: 'Email contains invalid characters' };
  }
  
  // Block disposable email providers
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'trashmail.com', 'yopmail.com',
    'temp-mail.org', 'mohmal.com', 'throwaway.email',
    'getnada.com', 'maildrop.cc', 'tempmailaddress.com'
  ];
  
  const domain = email.toLowerCase().split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Temporary email addresses are not allowed' };
  }
  
  return { valid: true };
}

// Circuit breaker for bot API with exponential backoff
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly timeout = 60000; // 1 minute base timeout

  canAttempt(): boolean {
    if (this.failures < this.threshold) return true;
    
    const backoffTime = Math.min(this.timeout * Math.pow(2, this.failures - this.threshold), 300000); // Max 5 minutes
    return Date.now() - this.lastFailure > backoffTime;
  }
  
  recordSuccess(): void {
    this.failures = 0;
  }
  
  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
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
        'User-Agent': 'H4C-Web-Service/1.0'
      },
      body: JSON.stringify({ 
        email,
        source: 'web',
        userAgent: userAgent.slice(0, 200), // Limit user agent length
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  
  // Enhanced rate limiting
  const rateLimitResult = rateLimiter.isAllowed(clientIp);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ 
      error: rateLimitResult.reason || 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
    });
  }

  try {
    const { email } = req.body;
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Additional rate limiting by email
    const emailRateLimit = rateLimiter.isAllowed(clientIp, cleanEmail);
    if (!emailRateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Too many subscription attempts for this email',
        retryAfter: emailRateLimit.retryAfter
      });
    }

    // Log subscription attempt securely
    console.log(`Email subscription attempt from ${clientIp.slice(0, -2)}xx`);

    // Notify bot API (non-blocking)
    const userAgent = req.headers['user-agent'] || '';
    notifyBotApi(cleanEmail, clientIp, userAgent).catch(err => 
      console.warn('Bot API notification failed:', err.message)
    );

    // Always return success to prevent email enumeration
    return res.status(200).json({ 
      success: true, 
      message: 'Thank you for subscribing! Please check your email for confirmation.'
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
      sizeLimit: '1kb', // Reduced from 1mb
    },
  },
}
