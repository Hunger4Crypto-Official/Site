import { User, Badge } from '../database/models.js';
import { algoClient } from '../utils/algorandClient.js';
import criteria from '../../shared/criteria.json' assert { type: 'json' };
import { RoleManagementService } from './roleManagementService.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../middleware/metrics.js';

function pickHodlBadgeId(balance) {
  if (balance >= criteria.badges.hodl.titan) return 'hodl-titan';
  if (balance >= criteria.badges.hodl.whale) return 'hodl-whale';
  if (balance >= criteria.badges.hodl.shark) return 'hodl-shark';
  if (balance >= criteria.badges.hodl.dolphin) return 'hodl-dolphin';
  if (balance >= criteria.badges.hodl.fish) return 'hodl-fish';
  if (balance >= criteria.badges.hodl.crab) return 'hodl-crab';
  if (balance >= criteria.badges.hodl.shrimp) return 'hodl-shrimp';
  return null;
}

export class BadgeEvaluationService {
  static async evaluateAndAwardHodl(client, guildId, discordId) {
    const user = await User.findOne({ discordId });
    if (!user?.walletAddress || !user.walletVerified) return { awarded: [] };

    const raw = await algoClient.getAssetBalance(user.walletAddress, criteria.assets.memo.asa_id);
    const balance = raw / Math.pow(10, criteria.assets.memo.decimals);
    const desired = pickHodlBadgeId(balance);
    if (!desired) return { awarded: [] };

    const badges = new Set(user.badges || []);
    if (!badges.has(desired)) {
      badges.add(desired);
      user.badges = [...badges];
      await user.save();
      await Badge.findOneAndUpdate(
        { badgeId: desired },
        {
          badgeId: desired,
          name: desired.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
          category: 'hodl',
          rarity: /titan|whale|shark|dolphin/i.test(desired) ? 'epic'
                : /fish|crab/i.test(desired) ? 'uncommon' : 'common',
          iconUrl: `/badges/${desired}.png`
        },
        { upsert: true, new: true }
      );
      metrics.awards_total++;
    }

    const guild = client.guilds.cache.get(guildId);
    if (guild) await RoleManagementService.syncHodlRoles(guild, discordId);

    logger.info({ discordId, desired, balance }, 'HODL evaluated & roles synced');
    return { awarded: badges.has(desired) ? [desired] : [] };
  }
}
