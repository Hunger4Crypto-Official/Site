import { User } from '../database/models.js';
import { logger } from '../utils/logger.js';
import { Settings } from '../utils/settings.js';
import { PersonalityService } from './personalityService.js';

const GM_FIELDS = {
  last: 'lastGMAt',
  count: 'gmCount',
  streak: 'gmStreak',
  longest: 'longestGmStreak'
};

const GN_FIELDS = {
  last: 'lastGNAt',
  count: 'gnCount',
  streak: 'gnStreak',
  longest: 'longestGnStreak'
};

const GM_STREAK_ACHIEVEMENTS = [
  { threshold: 3, key: 'gm-sprinter', label: 'GM Sprinter', description: 'Hit a 3-day GM streak.', badge: 'gm-sprinter' },
  { threshold: 7, key: 'gm-unstoppable', label: 'GM Unstoppable', description: 'Keep the GM energy for a full week.', badge: 'gm-unstoppable' },
  { threshold: 30, key: 'gm-legend', label: 'GM Legend', description: 'Drop GMs for 30 days straight.', badge: 'gm-legend' }
];

const GN_STREAK_ACHIEVEMENTS = [
  { threshold: 3, key: 'gn-sprinter', label: 'GN Sprinter', description: 'Wish the chat good night three days in a row.', badge: 'gn-sprinter' },
  { threshold: 7, key: 'gn-dedicated', label: 'GN Dedicated', description: 'Maintain a GN streak for a week.', badge: 'gn-dedicated' },
  { threshold: 30, key: 'gn-evergreen', label: 'GN Evergreen', description: '30 nights of check-ins. Dedication unlocked.', badge: 'gn-evergreen' }
];

const GM_COUNT_ACHIEVEMENTS = [
  { threshold: 10, key: 'gm-regular', label: 'GM Regular', description: '10 total GMs dropped.', badge: 'gm-regular' },
  { threshold: 50, key: 'gm-fiend', label: 'GM Fiend', description: '50 total GMs. Morning menace confirmed.', badge: 'gm-fiend' },
  { threshold: 150, key: 'gm-omnipresent', label: 'GM Omnipresent', description: '150 total GMs and counting.', badge: 'gm-omnipresent' }
];

const GN_COUNT_ACHIEVEMENTS = [
  { threshold: 10, key: 'gn-regular', label: 'GN Regular', description: '10 good nights logged.', badge: 'gn-regular' },
  { threshold: 40, key: 'gn-nightwatch', label: 'Night Watch', description: '40 GN check-ins. Do you sleep?', badge: 'gn-nightwatch' },
  { threshold: 120, key: 'gn-sentinel', label: 'Midnight Sentinel', description: '120 GN check-ins. Respect.', badge: 'gn-sentinel' }
];

const MEME_ACHIEVEMENTS = [
  { threshold: 1, key: 'meme-initiate', label: 'Meme Initiate', description: 'Dropped your very first meme.', badge: 'meme-initiate' },
  { threshold: 5, key: 'meme-dealer', label: 'Meme Dealer', description: '5 memes supplied to the culture.', badge: 'meme-dealer' },
  { threshold: 20, key: 'meme-overlord', label: 'Meme Overlord', description: '20 memes. You run the underground.', badge: 'meme-overlord' }
];

const RESURRECTION_ACHIEVEMENTS = [
  { threshold: 1, key: 'back-from-void', label: 'Back From The Void', description: 'Returned after a long slumber.', badge: 'back-from-void' },
  { threshold: 5, key: 'phoenix-rising', label: 'Phoenix Rising', description: 'Revived five times. Drama magnet.', badge: 'phoenix-rising' }
];

const DUAL_STREAK_ACHIEVEMENT = {
  key: 'circadian-champion',
  label: 'Circadian Champion',
  description: 'Hold both GM and GN streaks for at least a week.',
  badge: 'circadian-champion'
};

function hoursToMs(hours) {
  return Math.max(1, Number(hours || 0)) * 60 * 60 * 1000;
}

function computeStreak(previousStreak, lastAt, now) {
  if (!lastAt) return 1;
  const last = new Date(lastAt);
  const lastDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((today - lastDay) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return previousStreak || 1;
  }

  if (diffDays === 1) {
    return (previousStreak || 0) + 1;
  }

  return 1;
}

export class CommunityEngagementService {
  static client;
  static channelCache = new Map();

  static initialize(client) {
    this.client = client;
  }

  static async ensureUser(discordUser) {
    const discordId = typeof discordUser === 'string' ? discordUser : discordUser?.id;
    if (!discordId) return null;

    const update = {
      $setOnInsert: { discordId },
      $set: {}
    };

    if (typeof discordUser?.username === 'string') {
      update.$set.username = discordUser.username;
    }

    if (Object.keys(update.$set).length === 0) delete update.$set;

    const user = await User.findOneAndUpdate(
      { discordId },
      update,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return user;
  }

  static async recordMessage(message) {
    if (!message?.author) return null;
    const now = new Date();
    const discordId = message.author.id;

    const previous = await User.findOne({ discordId }).lean();
    const previousInteraction = previous?.community?.lastInteractionAt ? new Date(previous.community.lastInteractionAt) : null;

    const user = await User.findOneAndUpdate(
      { discordId },
      {
        $setOnInsert: { discordId },
        $set: {
          username: message.author.username,
          lastActive: now,
          'community.lastInteractionAt': now
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    if (previousInteraction) {
      await this.handleResurrection(previous, previousInteraction, now, message);
    }

    return user;
  }

  static async handleGreeting(message, type, userDoc = null) {
    const fields = type === 'gn' ? GN_FIELDS : GM_FIELDS;
    const cooldownMs = hoursToMs(type === 'gn' ? Settings.gnCooldownHours : Settings.gmCooldownHours);
    const now = new Date();

    const user = userDoc || await this.ensureUser(message.author);
    const community = user?.community || {};

    const lastAt = community[fields.last] ? new Date(community[fields.last]) : null;
    if (lastAt && (now - lastAt) < cooldownMs) {
      const nextAvailableAt = new Date(lastAt.getTime() + cooldownMs);
      return {
        updated: false,
        reason: 'cooldown',
        nextAvailableAt,
        count: community[fields.count] || 0,
        streak: community[fields.streak] || 0,
        user
      };

      return { updated: false, reason: 'cooldown', user };

    }

    const newStreak = computeStreak(community[fields.streak] || 0, lastAt, now);
    const update = {
      $set: {
        [`community.${fields.last}`]: now,
        [`community.${fields.streak}`]: newStreak,
        lastActive: now,
        'community.lastInteractionAt': now
      },
      $inc: {
        [`community.${fields.count}`]: 1
      }
    };

    if ((community[fields.longest] || 0) < newStreak) {
      update.$set[`community.${fields.longest}`] = newStreak;
    }

    const updatedUser = await User.findOneAndUpdate(
      { discordId: user.discordId },
      update,
      { new: true }
    );

    const achievements = await this.evaluateGreetingAchievements(updatedUser, type);

    const updatedCommunity = updatedUser?.community || {};
    const streak = updatedCommunity[fields.streak] ?? newStreak;
    const count = updatedCommunity[fields.count] ?? ((community[fields.count] || 0) + 1);

    return {
      updated: true,
      streak,
      count,
      achievements,
      user: updatedUser
    };
  }

  static async evaluateGreetingAchievements(user, type) {
    if (!user) return [];
    const unlocks = [];
    const community = user.community || {};
    const fields = type === 'gn' ? GN_FIELDS : GM_FIELDS;

    const streakAchievements = type === 'gn' ? GN_STREAK_ACHIEVEMENTS : GM_STREAK_ACHIEVEMENTS;
    for (const achievement of streakAchievements) {
      if ((community[fields.streak] || 0) >= achievement.threshold) {
        const granted = await this.grantAchievement(user, achievement, { type, streak: community[fields.streak] });
        if (granted) unlocks.push(achievement);
      }
    }

    const countAchievements = type === 'gn' ? GN_COUNT_ACHIEVEMENTS : GM_COUNT_ACHIEVEMENTS;
    for (const achievement of countAchievements) {
      if ((community[fields.count] || 0) >= achievement.threshold) {
        const granted = await this.grantAchievement(user, achievement, { type, count: community[fields.count] });
        if (granted) unlocks.push(achievement);
      }
    }

    if ((community.longestGmStreak || 0) >= 7 && (community.longestGnStreak || 0) >= 7) {
      const granted = await this.grantAchievement(user, DUAL_STREAK_ACHIEVEMENT, {
        gm: community.longestGmStreak,
        gn: community.longestGnStreak
      });
      if (granted) unlocks.push(DUAL_STREAK_ACHIEVEMENT);
    }

    return unlocks;
  }

  static async incrementMeme(discordId) {
    const user = await User.findOneAndUpdate(
      { discordId },
      {
        $setOnInsert: { discordId },
        $inc: { 'community.memesPosted': 1 },
        $set: { lastActive: new Date(), 'community.lastMemeAt': new Date() }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const unlocks = [];
    const memes = user?.community?.memesPosted || 0;
    for (const achievement of MEME_ACHIEVEMENTS) {
      if (memes >= achievement.threshold) {
        const granted = await this.grantAchievement(user, achievement, { memes });
        if (granted) unlocks.push(achievement);
      }
    }
    return { user, unlocks, total: memes };
  }

  static async handleResurrection(previousUser, previousInteraction, now, message) {
    if (!previousInteraction || !message) return;
    const thresholdMs = hoursToMs(Settings.resurrectionThresholdHours);
    if ((now - previousInteraction) < thresholdMs) return;

    const lastResAt = previousUser?.community?.lastResurrectionAt ? new Date(previousUser.community.lastResurrectionAt) : null;
    if (lastResAt && (now - lastResAt) < thresholdMs / 2) {
      return;
    }

    const days = Math.max(1, Math.round((now - previousInteraction) / (24 * 60 * 60 * 1000)));

    const channelId = Settings.chatboxChannelId || message.channelId;
    const channel = await this.resolveChannel(channelId);
    if (!channel) return;

    try {
      await channel.send(PersonalityService.resurrectionMessage(message.author, days));
    } catch (error) {
      logger.error({ error: String(error), channelId }, 'Failed to deliver resurrection message');
    }

    const updatedUser = await User.findOneAndUpdate(
      { discordId: message.author.id },
      {
        $set: {
          'community.lastResurrectionAt': now,
          'community.lastInteractionAt': now,
          lastActive: now
        },
        $inc: {
          'community.resurrectionCount': 1
        }
      },
      { new: true }
    );

    if (updatedUser) {
      const count = updatedUser.community?.resurrectionCount || 0;
      for (const achievement of RESURRECTION_ACHIEVEMENTS) {
        if (count >= achievement.threshold) {
          await this.grantAchievement(updatedUser, achievement, { count });
        }
      }
    }
  }

  static async grantAchievement(user, achievement, meta = {}) {
    if (!user) return false;
    const already = (user.achievements || []).some(a => a.key === achievement.key);
    if (already) return false;

    const update = {
      $push: {
        achievements: {
          key: achievement.key,
          label: achievement.label,
          description: achievement.description,
          unlockedAt: new Date(),
          meta
        }
      }
    };

    if (achievement.badge) {
      update.$addToSet = { badges: achievement.badge };
    }

    const updated = await User.findOneAndUpdate(
      { discordId: user.discordId, 'achievements.key': { $ne: achievement.key } },
      update,
      { new: true }
    );

    if (!updated) return false;

    logger.info({ discordId: user.discordId, achievement: achievement.key }, 'Achievement granted');
    await this.announceAchievement(updated, achievement);
    user.achievements = updated.achievements;
    if (achievement.badge) {
      user.badges = updated.badges;
    }
    return true;
  }

  static async announceAchievement(user, achievement) {
    if (!this.client || !Settings.activityChannelId) return;

    const channel = await this.resolveChannel(Settings.activityChannelId);
    if (!channel) return;

    try {
      const line = `Achievement unlocked for <@${user.discordId}>: **${achievement.label}** — ${achievement.description}`;
      await channel.send(PersonalityService.wrap(line, { noPrefix: true }));
    } catch (error) {
      logger.error({ error: String(error), achievement: achievement.key }, 'Failed to announce achievement');
    }
  }

  static async resolveChannel(channelId) {
    if (!this.client || !channelId) return null;
    if (this.channelCache.has(channelId)) return this.channelCache.get(channelId);

    try {
      let channel = this.client.channels.cache.get(channelId);
      if (!channel) {
        channel = await this.client.channels.fetch(channelId);
      }
      if (channel) {
        this.channelCache.set(channelId, channel);
      }
      return channel;
    } catch (error) {
      logger.error({ error: String(error), channelId }, 'Failed to resolve channel');
      return null;
    }
  }

  static async getLeaderboard(type = 'gm', limit = 10) {
    const fields = type === 'gn' ? GN_FIELDS : GM_FIELDS;
    const projection = 'discordId username community badges';
    return User.find({ [`community.${fields.count}`]: { $gt: 0 } })
      .select(projection)
      .sort({ [`community.${fields.count}`]: -1, [`community.${fields.longest}`]: -1 })
      .limit(limit)
      .lean();
  }

  static async listAchievements(discordId) {
    const user = await User.findOne({ discordId }).select('achievements').lean();
    return user?.achievements?.sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt)) || [];
  }

  static async getCommunityStats() {
    const pipeline = [
      {
        $group: {
          _id: null,
          gmCount: { $sum: { $ifNull: ['$community.gmCount', 0] } },
          gnCount: { $sum: { $ifNull: ['$community.gnCount', 0] } },
          memes: { $sum: { $ifNull: ['$community.memesPosted', 0] } },
          users: { $sum: 1 },
          gmMax: { $max: { $ifNull: ['$community.longestGmStreak', 0] } },
          gnMax: { $max: { $ifNull: ['$community.longestGnStreak', 0] } }
        }
      }
    ];

    const [result] = await User.aggregate(pipeline);
    return {
      totalUsers: result?.users || 0,
      totalGm: result?.gmCount || 0,
      totalGn: result?.gnCount || 0,
      totalMemes: result?.memes || 0,
      topGmStreak: result?.gmMax || 0,
      topGnStreak: result?.gnMax || 0
    };
  }

  static async resetUser(discordId, scope = 'all') {
    const set = {};
    const unset = {};

    if (scope === 'gm' || scope === 'all') {
      set['community.gmCount'] = 0;
      set['community.gmStreak'] = 0;
      set['community.longestGmStreak'] = 0;
      unset['community.lastGMAt'] = '';
    }

    if (scope === 'gn' || scope === 'all') {
      set['community.gnCount'] = 0;
      set['community.gnStreak'] = 0;
      set['community.longestGnStreak'] = 0;
      unset['community.lastGNAt'] = '';
    }

    if (scope === 'memes' || scope === 'all') {
      set['community.memesPosted'] = 0;
      unset['community.lastMemeAt'] = '';
    }

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    if (!Object.keys(update).length) return null;

    const user = await User.findOneAndUpdate({ discordId }, update, { new: true });
    return user;
  }

  static async shadowban(discordId, value = true) {
    return User.findOneAndUpdate(
      { discordId },
      { $set: { shadowbanned: value } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  static async isShadowbanned(discordId) {
    const user = await User.findOne({ discordId }).select('shadowbanned').lean();
    return !!user?.shadowbanned;
  }
}
