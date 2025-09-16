import { redis } from '../utils/redisClient.js';

function parseAllowList(s) {
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function ipFrom(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
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

      const data = await redis.hgetall(key);
      let tokens = Number(data.tokens || maxTokens);
      let ts = Number(data.ts || now);

      const elapsedSec = Math.max(0, (now - ts) / 1000);
      const refill = elapsedSec * refillPerSec;
      tokens = Math.min(maxTokens + burst, tokens + refill);
      if (tokens < 1) {
        const retryAfter = Math.ceil((1 - tokens) / refillPerSec);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ ok:false, error:'rate_limited' });
      }
      tokens -= 1;

      await redis.hmset(key, { tokens, ts: now });
      await redis.pexpire(key, windowMs);

      return next();
    } catch {
      return next(); // fail-open
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
    if (allowList.length > 0) {
      const ok = allowList.some(prefix => ip.startsWith(prefix));
      if (!ok) return res.status(403).json({ ok:false, error:'forbidden_ip' });
    }
    return rl(req, res, next);
  };
}
