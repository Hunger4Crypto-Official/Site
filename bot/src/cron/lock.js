import { redis } from '../utils/redisClient.js';

export async function withLock(key, ttlMs, fn) {
  const token = `${Date.now()}-${Math.random()}`;
  const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (!ok) return { skipped: true };
  try { return await fn(); }
  finally {
    const v = await redis.get(key);
    if (v === token) await redis.del(key);
  }
}
