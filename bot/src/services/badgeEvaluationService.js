import { User, Badge } from '../database/models.js';
import { algoClient } from '../utils/algorandClient.js';
import { criteria } from '../../../shared/index.js';
import { RoleManagementService } from './roleManagementService.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../middleware/metrics.js';

function pickHodlBadgeId(balance) {
  const thresholds = criteria.badges.hodl;
  
  if (balance >= thresholds.titan) return 'hodl-titan';
  if (balance >= thresholds.whale) return 'hodl-whale';
  if (balance >= thresholds.shark) return 'hodl-shark';
  if (balance >= thresholds.dolphin) return 'hodl-dolphin';
  if (balance >= thresholds.fish) return 'hodl-fish';
  if (balance >= thresholds.crab) return 'hodl-crab';
  if (balance >= thresholds.shrimp) return 'hodl-shrimp';
  return null;
}

function pickLpBadgeId(lpUsd) {
  const thresholds = criteria.badges.lp;
  
  if (lpUsd >= thresholds.diamond) return 'lp-diamond';
  if (lpUsd >= thresholds.platinum) return 'lp-platinum';
  if (lpUsd >= thresholds.gold) return 'lp-gold';
  if (lpUsd >= thresholds.silver) return 'lp-silver';
  if (lpUsd >= thresholds.bronze) return 'lp-bronze';
  return null;
}

function getBadgeRarity(badgeId) {
  if (/titan|diamond/.test(badgeId)) return 'legendary';
  if (/whale|shark|platinum/.test(badgeId)) return 'epic';
  if (/dolphin|fish|gold/.test(badgeId)) return 'rare';
  if (/crab|silver/.test(badgeId)) return 'uncommon';
  return 'common';
}

export class BadgeEvaluationService {
  static async evaluateAndAwardHodl(client, guildId, discordId) {
    try {
      const user = await User.findOne({ discordId });
      if (!user?.walletAddress || !user.walletVerified) {
        logger.debug({ discordId }, 'User not verified or no wallet');
        return { awarded: [] };
      }

      // Get current $MemO balance with error handling
      let rawBalance;
      try {
        rawBalance = await algoClient.getAssetBalance(
          user.walletAddress, 
          criteria.assets.memo.asa_id
        );
      } catch (error) {
        logger.error({ error: String(error), discordId, wallet: user.walletAddress }, 'Failed to get balance');
        return { awarded: [], error: 'Balance check failed' };
      }

      const balance = rawBalance / Math.pow(10, criteria.assets.memo.decimals);
      
      const desiredBadge = pickHodlBadgeId(balance);
      if (!desiredBadge) {
        logger.debug({ discordId, balance }, 'No badge threshold met');
        return { awarded: [] };
      }

      // FIXED: Use atomic operations to prevent race conditions
      const hodlBadges = ['hodl-shrimp', 'hodl-crab', 'hodl-fish', 'hodl-dolphin', 'hodl-shark', 'hodl-whale', 'hodl-titan'];
      
      // Remove all lower tier HODL badges atomically
      const removedBadges = hodlBadges.filter(badge => badge !== desiredBadge);
      
      const updateResult = await User.findOneAndUpdate(
        { discordId },
        {
          $pull: { badges: { $in: removedBadges } },
          $addToSet: { badges: desiredBadge }
        },
        { 
          new: true,
          upsert: false // Don't create if user doesn't exist
        }
      );

      if (!updateResult) {
        logger.error({ discordId }, 'User not found during badge update');
        return { awarded: [], error: 'User not found' };
      }

      // Check if badge was actually added (wasn't already present)
      const previousBadges = user.badges || [];
      const newlyAwarded = previousBadges.includes(desiredBadge) ? [] : [desiredBadge];

      if (newlyAwarded.length > 0) {
        // Ensure badge exists in database
        await Badge.findOneAndUpdate(
          { badgeId: desiredBadge },
          {
            badgeId: desiredBadge,
            name: desiredBadge.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
            category: 'hodl',
            rarity: getBadgeRarity(desiredBadge),
            iconUrl: `/badges/${desiredBadge}.png`,
            description: `HODL ${balance.toLocaleString()} $MemO tokens`
          },
          { upsert: true, new: true }
        );

        metrics.awards_total++;
        
        logger.info({ 
          discordId, 
          desiredBadge, 
          balance: Math.round(balance),
          removedBadges 
        }, 'HODL badge awarded');
      }

      // Sync Discord roles
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          await RoleManagementService.syncHodlRoles(guild, discordId);
        }
      } catch (error) {
        logger.error({ error: String(error), discordId }, 'Role sync failed');
        // Don't fail the badge award if role sync fails
      }

      return { 
        awarded: newlyAwarded,
        removed: removedBadges.filter(badge => previousBadges.includes(badge)),
        currentBadge: desiredBadge,
        balance: Math.round(balance)
      };

    } catch (error) {
      logger.error({ error: String(error), discordId }, 'Badge evaluation failed');
      return { awarded: [], error: String(error) };
    }
  }

  static async evaluateAndAwardLp(client, guildId, discordId, lpUsdValue) {
    try {
      const user = await User.findOne({ discordId });
      if (!user?.walletAddress || !user.walletVerified) {
        return { awarded: [] };
      }

      const desiredBadge = pickLpBadgeId(lpUsdValue);
      if (!desiredBadge) {
        return { awarded: [] };
      }

      // FIXED: Use atomic operations for LP badges too
      const lpBadges = ['lp-bronze', 'lp-silver', 'lp-gold', 'lp-platinum', 'lp-diamond'];
      const removedBadges = lpBadges.filter(badge => badge !== desiredBadge);
      
      const updateResult = await User.findOneAndUpdate(
        { discordId },
        {
          $pull: { badges: { $in: removedBadges } },
          $addToSet: { badges: desiredBadge }
        },
        { new: true, upsert: false }
      );

      if (!updateResult) {
        return { awarded: [], error: 'User not found' };
      }

      const previousBadges = user.badges || [];
      const newlyAwarded = previousBadges.includes(desiredBadge) ? [] : [desiredBadge];

      if (newlyAwarded.length > 0) {
        await Badge.findOneAndUpdate(
          { badgeId: desiredBadge },
          {
            badgeId: desiredBadge,
            name: desiredBadge.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
            category: 'liquidity_provider',
            rarity: getBadgeRarity(desiredBadge),
            iconUrl: `/badges/${desiredBadge}.png`,
            description: `Provide $${Math.round(lpUsdValue)} in liquidity`
          },
          { upsert: true, new: true }
        );

        metrics.awards_total++;
        
        logger.info({ 
          discordId, 
          desiredBadge, 
          lpUsdValue: Math.round(lpUsdValue),
          removedBadges 
        }, 'LP badge awarded');
      }

      return { 
        awarded: newlyAwarded,
        removed: removedBadges.filter(badge => previousBadges.includes(badge)),
        currentBadge: desiredBadge,
        lpUsdValue: Math.round(lpUsdValue)
      };

    } catch (error) {
      logger.error({ error: String(error), discordId }, 'LP badge evaluation failed');
      return { awarded: [], error: String(error) };
    }
  }

  // Evaluate all badge types for a user
  static async evaluateAllBadges(client, guildId, discordId) {
    try {
      const results = {
        hodl: await this.evaluateAndAwardHodl(client, guildId, discordId),
        lp: { awarded: [] } // LP evaluation requires external LP USD value
      };

      logger.debug({ discordId, results }, 'All badges evaluated');
      return results;
    } catch (error) {
      logger.error({ error: String(error), discordId }, 'Badge evaluation failed');
      return { hodl: { awarded: [] }, lp: { awarded: [] }, error: String(error) };
    }
  }
}
