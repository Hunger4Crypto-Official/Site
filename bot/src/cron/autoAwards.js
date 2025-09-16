import { logger } from '../utils/logger.js';
import { User } from '../database/models.js';
import { BadgeEvaluationService } from '../services/badgeEvaluationService.js';
import { Env } from '../utils/envGuard.js';
import { withLock } from './lock.js';

const INTERVAL_MS = Env.BUCKET_PERIOD_MIN * 60 * 1000;

function bucketOf(discordId) {
  const n = BigInt('0x' + discordId.slice(-6));
  return Number(n % BigInt(Env.BUCKETS));
}

async function scanBucket(client, k) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const users = await User.find({ walletAddress: { $exists: true }, walletVerified: true })
    .select('discordId')
    .lean();
  const slice = users.filter(u => bucketOf(u.discordId) === k);

  logger.info({ total: users.length, bucket: k, slice: slice.length }, 'Auto-awards: scan start');
  for (let i = 0; i < slice.length; i += Env.SCAN_CONCURRENCY) {
    const batch = slice.slice(i, i + Env.SCAN_CONCURRENCY);
    await Promise.all(batch.map(async u => {
      try {
        await BadgeEvaluationService.evaluateAndAwardHodl(client, guildId, u.discordId);
      } catch (e) {
        logger.warn({ e: String(e), user: u.discordId }, 'Auto-awards: evaluate failed');
      }
    }));
    await new Promise(r => setTimeout(r, Env.SCAN_SPACING_MS));
  }
  logger.info({ bucket: k }, 'Auto-awards: scan complete');
}

export async function runAutoAwards(client) {
  const minute = Math.floor(Date.now() / 60000);
  const k = minute % Env.BUCKETS;
  await withLock('locks:autoAwards', INTERVAL_MS - 1000, () => scanBucket(client, k));
}

let timer = null;
export function startAutoAwards(client) {
  if (timer) clearInterval(timer);
  timer = setInterval(() => runAutoAwards(client), INTERVAL_MS);
  setTimeout(() => runAutoAwards(client), 10_000);
  return () => clearInterval(timer);
}
