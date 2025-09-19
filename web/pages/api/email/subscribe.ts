// web/pages/api/email/subscribe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';

// -----------------------------
// Config (tweak via ENV)
// -----------------------------
const EMAIL_BODY_MAX_BYTES = 1024; // 1 KB
const IP_WINDOW_MS = 60_000;       // 1 minute
const IP_MAX_ATTEMPTS = 5;
const IP_BLOCK_MS = 5 * 60_000;    // 5 minutes
const EMAIL_MAX_ATTEMPTS_PER_HOUR = 3;
const BOT_TIMEOUT_MS = 5_000;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

// -----------------------------
// Utilities
// -----------------------------

/** Return hostname (no port) from a URL-ish string; empty if invalid. */
function safeHostname(urlLike?: string): string {
  if (!urlLike) return '';
  try {
    const u = new URL(urlLike);
    return (u.hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

/** Prefer CF-Connecting-IP, else parse X-Forwarded-For chain, else socket address. IPv4 & IPv6 supported. */
function getClientIp(req: NextApiRequest): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) {
    return cf.trim();
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    // Take first non-empty token
    const first = xff.split(',').map(s => s.trim()).find(Boolean);
    if (first) return first;
  }

  return req.socket?.remoteAddress || 'unknown';
}

/** Very lenient validators just to categorize IPv4 vs IPv6 for masking. */
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

/** Mask IP for logs (IPv4 -> a.b.x.x; IPv6 -> keep first 4 hextets). */
function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (IPV4_RE.test(ip)) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  }
  // IPv6 or others
  if (ip.includes(':') || IPV6_RE.test(ip)) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  return 'unknown';
}

/** Reject obviously invalid or special-use source IPs. */
function isBlockedSourceIp(ip: string): boolean {
  if (ip === 'unknown') return false;
  if (IPV4_RE.test(ip)) {
    return (
      ip.startsWith('0.') ||
      ip.startsWith('127.') ||            // loopback
      ip.startsWith('169.254.') ||       // link-local
      ip.startsWith('224.') ||           // multicast
      ip.startsWith('240.')              // reserved
    );
  }
  // For IPv6, allow through; you can add specific ranges if needed.
  return false;
}

/** Minimal strictness: require JSON content-type and small body. */
function validateRequestBasics(req: NextApiRequest): { ok: boolean; error?: string } {
  const ct = (req.headers['content-type'] || '').toString().toLowerCase();
  if (!ct.includes('application/json')) {
    return { ok: false, error: 'Unsupported content type' };
  }
  const len = req.headers['content-length'];
  if (len && Number.isFinite(Number(len)) && Number(len) > EMAIL_BODY_MAX_BYTES) {
    return { ok: false, error: 'Request too large' };
  }
  return { ok: true };
}

/** Same-site check: require Origin/Referer host to match Host or be in ALLOWED_ORIGINS; allow localhost in dev. */
function validateOrigin(req: NextApiRequest): boolean {
  const hostHeader = (req.headers.host || '').toString().split(':')[0].toLowerCase();
  const originHost = safeHostname(req.headers.origin as string);
  const refererHost = safeHostname(req.headers.referer as string);

  const dev = process.env.NODE_ENV !== 'production';
  const isLocalhost = (h: string) => h === 'localhost' || h === '127.0.0.1';

  const allowedHosts = new Set<string>([
    hostHeader,
    ...ALLOWED_ORIGINS,
    ...(dev ? ['localhost', '127.0.0.1'] : []),
  ].filter(Boolean));

  if (originHost && allowedHosts.has(originHost)) return true;
  if (refererHost && allowedHosts.has(refererHost)) return true;

  // If neither origin nor referer provided (some clients), allow only same host.
  return Boolean(hostHeader);
}

// -----------------------------
// Email validation
// -----------------------------
const DISPOSABLE_DOMAINS = new Set<string>([
  // Core
  '10minutemail.com','tempmail.org','guerrillamail.com','mailinator.com','trashmail.com','yopmail.com',
  'temp-mail.org','mohmal.com','throwaway.email','getnada.com','maildrop.cc','tempmailaddress.com',
  'sharklasers.com','guerrillamailblock.com','pokemail.net','spam4.me','bccto.me','chacuo.net','mytrashmail.com',
]);

function validateEmail(raw: unknown): { valid: boolean; email?: string; error?: string } {
  if (typeof raw !== 'string') return { valid: false, error: 'Email is required' };

  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) {
    return { valid: false, error: 'Invalid email length' };
    }
  const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!basic) return { valid: false, error: 'Invalid email format' };

  // Injection-ish characters / encodings / control chars
  const badPatterns = [
    /<[^>]*>/, /javascript:/i, /data:/i, /['"\\]/, /[{}]/, /%[0-9a-f]{2}/i, /[\x00-\x1f]/,
  ];
  if (badPatterns.some(re => re.test(email))) {
    return { valid: false, error: 'Email contains invalid characters' };
  }

  const [, domain = ''] = email.split('@');
  if (!domain || domain.length < 3 || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, error: 'Invalid email domain' };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: 'Temporary email addresses are not allowed' };
  }

  return { valid: true, email };
}

// -----------------------------
// Rate limiting (in-memory)
// -----------------------------
type RLRecord = {
  count: number;
  resetTime: number;
  attempts: number;
  blocked: boolean;
  blockUntil?: number;
};

class SecurityRateLimiter {
  private store = new Map<string, RLRecord>();

  isAllowed(ip: string, email?: string): {
    allowed: boolean; retryAfter?: number; reason?: string; remaining?: number;
  } {
    const now = Date.now();

    const ipRes = this.checkKey(`ip:${ip}`, IP_MAX_ATTEMPTS, IP_WINDOW_MS, now, true);
    if (!ipRes.allowed) return ipRes;

    if (email) {
      const emailKey = 'email:' + createHash('sha256').update(email).digest('hex').slice(0, 16);
      const emRes = this.checkKey(emailKey, EMAIL_MAX_ATTEMPTS_PER_HOUR, 60 * 60_000, now, false);
      if (!emRes.allowed) return emRes;
    }

    return { allowed: true, remaining: IP_MAX_ATTEMPTS - (ipRes.count || 0) };
  }

  private checkKey(key: string, max: number, windowMs: number, now: number, blockOnExceed: boolean) {
    let rec = this.store.get(key);

    if (rec && now > rec.resetTime && !rec.blocked) {
      this.store.delete(key);
      rec = undefined;
    }

    if (rec?.blocked && rec.blockUntil && now < rec.blockUntil) {
      return { allowed: false, retryAfter: Math.ceil((rec.blockUntil - now) / 1000), reason: 'Temporarily blocked' };
    }

    if (!rec) {
      rec = { count: 1, resetTime: now + windowMs, attempts: 1, blocked: false };
      this.store.set(key, rec);
      return { allowed: true, count: 1 };
    }

    if (rec.count >= max) {
      if (blockOnExceed) {
        rec.blocked = true;
        rec.blockUntil = now + IP_BLOCK_MS;
        rec.attempts++;
        return { allowed: false, retryAfter: Math.ceil(IP_BLOCK_MS / 1000), reason: 'Rate limit exceeded. IP blocked.' };
      }
      return { allowed: false, retryAfter: Math.ceil((rec.resetTime - now) / 1000), reason: 'Too many attempts' };
    }

    rec.count++;
    return { allowed: true, count: rec.count };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, rec] of this.store.entries()) {
      const expired = now > rec.resetTime + IP_BLOCK_MS;
      if (expired && !rec.blocked) this.store.delete(key);
    }
  }
}

const rateLimiter = new SecurityRateLimiter();

// Guarded for serverless/edge environments
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 300_000);
}

// -----------------------------
// Circuit breaker + Bot notify
// -----------------------------
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly base = 60_000; // 1 min
  private readonly max = 300_000; // 5 min

  canAttempt(): boolean {
    if (this.failures < this.threshold) return true;
    const backoff = Math.min(this.base * Math.pow(2, this.failures - this.threshold), this.max);
    return Date.now() - this.lastFailure > backoff;
  }
  recordSuccess() { this.failures = 0; }
  recordFailure() { this.failures++; this.lastFailure = Date.now(); }
  status() { return { failures: this.failures, isOpen: this.failures >= this.threshold, canAttempt: this.canAttempt() }; }
}

const botBreaker = new CircuitBreaker();

async function notifyBotApi(email: string, ip: string, ua: string): Promise<boolean> {
  const botUrl = process.env.BOT_API_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  if (!adminSecret || !botBreaker.canAttempt()) return false;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);

    const res = await fetch(`${botUrl}/api/email/web-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`,
        'User-Agent': 'H4C-Web-Service/1.0',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({
        email, source: 'web', userAgent: (ua || '').slice(0, 200), ip, timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(t);

    if (res.ok) {
      botBreaker.recordSuccess();
      return true;
    }
    botBreaker.recordFailure();
    return false;
  } catch {
    botBreaker.recordFailure();
    return false;
  }
}

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const basic = validateRequestBasics(req);
  if (!basic.ok) {
    return res.status(basic.error === 'Request too large' ? 413 : 415).json({ error: basic.error });
  }

  if (!validateOrigin(req)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  const clientIp = getClientIp(req);
  if (isBlockedSourceIp(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { email: rawEmail } = (req.body ?? {}) as { email?: unknown };

    const v = validateEmail(rawEmail);
    if (!v.valid || !v.email) {
      // Do NOT return success here; we prefer explicit 400 to help real users fix typos (enumeration is still mitigated by not disclosing existence).
      return res.status(400).json({ error: v.error || 'Invalid email' });
    }

    // Rate limit (IP + email)
    const rl = rateLimiter.isAllowed(clientIp, v.email);
    if (!rl.allowed) {
      return res.status(429).json({ error: rl.reason || 'Rate limit exceeded', retryAfter: rl.retryAfter });
    }

    // Security logging (anonymized)
    console.log('Email subscription attempt', {
      ts: new Date().toISOString(),
      ip: maskIp(clientIp),
      emailDomain: v.email.split('@')[1],
      ua: (req.headers['user-agent'] || 'unknown').toString().slice(0, 80),
      remaining: rl.remaining,
    });

    // Notify bot (non-blocking)
    const ua = (req.headers['user-agent'] || '').toString();
    // Fire and forget; errors are handled internally by circuit breaker.
    notifyBotApi(v.email, clientIp, ua).catch(() => { /* no-op */ });

    // Always a generic success to avoid email enumeration subtleties in the success path.
    const dev = process.env.NODE_ENV !== 'production';
    return res.status(200).json({
      success: true,
      message: 'Thank you for subscribing! Please check your email for confirmation.',
      ...(dev ? { debug: { rateLimitRemaining: rl.remaining, circuit: botBreaker.status() } } : {}),
    });
  } catch (err) {
    console.error('Email subscription error', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1kb',
    },
  },
};
