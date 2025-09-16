import { getEthScoreV2 } from './reputation/ethService.js';
import { getSolScoreV2 } from './reputation/solService.js';
import { User } from '../database/models.js';
import { redis } from '../utils/redisClient.js';

const TTL_SECS = Number(process.env.REP_V2_TTL_SECS || 900); // 15m

export class CrossChainService {
  static async getUserWallets(userId) {
    const u = await User.findOne({ discordId: userId });
    return {
      algorand: u?.walletAddress || null,
      ethereum: u?.ethAddress || null,
      solana: u?.solAddress || null
    };
  }

  static async calculateCrossChainReputation(userId) {
    const wallets = await this.getUserWallets(userId);
    const key = `repv2:${wallets.ethereum || '-'}:${wallets.solana || '-'}`;
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    let score = 0;
    const details = {};

    if (wallets.ethereum) {
      const s = await getEthScoreV2(wallets.ethereum).catch(() => ({ total: 0, details: {} }));
      score += s.total || 0;
      details.eth = s;
    }
    if (wallets.solana) {
      const s = await getSolScoreV2(wallets.solana).catch(() => ({ total: 0, details: {} }));
      score += s.total || 0;
      details.sol = s;
    }

    const result = { score, details, wallets, version: 2 };
    await redis.setex(key, TTL_SECS, JSON.stringify(result));
    return result;
  }
}
