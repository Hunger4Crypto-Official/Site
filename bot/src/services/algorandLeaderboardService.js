import { User } from '../database/models.js';
import { redis } from '../utils/redisClient.js';
import { getEnabledDexes } from './dex/index.js';

const SNAP_KEY = 'lp:snapshot';
const META_KEY = 'lp:snapshot:meta';
const SNAP_TTL = Number(process.env.LP_SNAPSHOT_TTL_SECS || 7200); // 2h
const MEMO_ASA = Number(process.env.MEMO_ASA_ID || 885835936);

async function lpUsdAcrossDexes(address) {
  const dexes = getEnabledDexes();
  let total = 0;
  for (const d of dexes) {
    const usd = await d.getUserLpUsd(address, MEMO_ASA);
    if (Number.isFinite(usd) && usd > 0) total += usd;
    await new Promise(r => setTimeout(r, 120));
  }
  return Math.round(total);
}

export class AlgorandLeaderboardService {
  static async computeSnapshot(limit = 100) {
    const users = await User.find({
      walletAddress: { $exists: true },
      walletVerified: true
    }).select('discordId username walletAddress').lean();

    const results = [];
    const chunk = 6;
    for (let i = 0; i < users.length; i += chunk) {
      const slice = users.slice(i, i + chunk);
      const vals = await Promise.all(slice.map(async u => {
        try {
          const usd = await lpUsdAcrossDexes(u.walletAddress);
          return { userId: u.discordId, username: u.username, lpUsd: usd };
        } catch {
          return { userId: u.discordId, username: u.username, lpUsd: 0 };
        }
      }));
      results.push(...vals);
      await new Promise(r => setTimeout(r, 150));
    }

    const sorted = results
      .filter(r => r.lpUsd > 0)
      .sort((a,b) => b.lpUsd - a.lpUsd)
      .slice(0, limit);

    const meta = { ts: Date.now(), count: sorted.length, ttl: SNAP_TTL, dexes: getEnabledDexes().map(d => d.name) };
    await redis.set(SNAP_KEY, JSON.stringify(sorted), 'EX', SNAP_TTL);
    await redis.hmset(META_KEY, meta);
    await redis.expire(META_KEY, SNAP_TTL);
    return { list: sorted, meta };
  }

  static async getSnapshot() {
    const raw = await redis.get(SNAP_KEY);
    if (raw) {
      const meta = await redis.hgetall(META_KEY);
      return { list: JSON.parse(raw), meta };
    }
    return this.computeSnapshot();
  }
}
