import { GuildMember } from 'discord.js';
import { metrics } from '../middleware/metrics.js';

const roleMap = [
  { env: 'ROLE_HODL_TITAN_ID', id: process.env.ROLE_HODL_TITAN_ID },
  { env: 'ROLE_HODL_WHALE_ID', id: process.env.ROLE_HODL_WHALE_ID },
  { env: 'ROLE_HODL_SHARK_ID', id: process.env.ROLE_HODL_SHARK_ID },
  { env: 'ROLE_HODL_DOLPHIN_ID', id: process.env.ROLE_HODL_DOLPHIN_ID },
  { env: 'ROLE_HODL_FISH_ID', id: process.env.ROLE_HODL_FISH_ID },
  { env: 'ROLE_HODL_CRAB_ID', id: process.env.ROLE_HODL_CRAB_ID },
  { env: 'ROLE_HODL_SHRIMP_ID', id: process.env.ROLE_HODL_SHRIMP_ID }
].filter(r => r.id);

function highestTier(roles) {
  for (const r of roleMap) {
    if (roles.has(r.id)) return r.id;
  }
  return null;
}

export class RoleManagementService {
  static async syncHodlRoles(guild, discordId) {
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return { changed: false };

    // Determine desired highest tier by checking badges already set on user
    // In this service we don't re-evaluate; BadgeEvaluationService handles awards
    // We derive from existing role presence to converge to the highest.
    const currentHighest = highestTier(member.roles.cache);
    let desired = currentHighest; // convergence if already at correct tier

    // If you want to set desired from DB badges, inject it here (optional).

    // No change path
    if (desired && currentHighest === desired) return { changed: false };

    // Remove lower tiers, keep only highest if present
    const toRemove = roleMap.map(r => r.id).filter(id => id && member.roles.cache.has(id));
    const promises = [];
    if (toRemove.length) promises.push(member.roles.remove(toRemove).catch(()=>{}));
    if (desired) promises.push(member.roles.add(desired).catch(()=>{}));
    await Promise.all(promises);

    metrics.roles_synced_total++;
    return { changed: true };
  }

  static async batchSyncHodlRoles(guild) {
    const members = await guild.members.fetch();
    let changed = 0;
    for (const [id, _m] of members) {
      const res = await this.syncHodlRoles(guild, id);
      if (res.changed) changed++;
      await new Promise(r => setTimeout(r, 100));
    }
    return { changed, total: members.size };
  }
}
