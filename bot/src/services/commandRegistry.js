import { User } from '../database/models.js';
import { logger } from '../utils/logger.js';
import { Settings } from '../utils/settings.js';
import { randomFrom, quickQuips, storyJabs, loreDrops, chaosEvents, cryptoJokes, techFacts, memeVault } from '../utils/botResponses.js';
import { PersonalityService } from './personalityService.js';
import { CommunityEngagementService } from './communityEngagementService.js';
import { RandomChatterService } from './randomChatterService.js';

function formatLeaderboardEntry(entry, index) {
  const community = entry.community || {};
  const gm = community.gmCount || 0;
  const gn = community.gnCount || 0;
  const meme = community.memesPosted || 0;
  return `${index + 1}. <@${entry.discordId}> — ${gm} GM / ${gn} GN / ${meme} memes (streak: ${community.longestGmStreak || 0}/${community.longestGnStreak || 0})`;
}

export class CommandRegistry {
  constructor(client) {
    this.client = client;
    this.prefix = Settings.prefix || '!';
    this.ownerIds = Settings.ownerIds || new Set();
    this.commands = new Map();
    this.registerDefaults();
  }

  register(name, handler, options = {}) {
    this.commands.set(name.toLowerCase(), {
      name: name.toLowerCase(),
      handler,
      description: options.description || 'No description',
      ownerOnly: Boolean(options.ownerOnly)
    });
  }

  async handle(message, userDoc = null) {
    if (!message?.content || !message.content.startsWith(this.prefix)) return false;

    const [rawName, ...args] = message.content.slice(this.prefix.length).trim().split(/\s+/);
    if (!rawName) return false;

    const command = this.commands.get(rawName.toLowerCase());
    if (!command) return false;

    if (command.ownerOnly && !this.ownerIds.has(message.author.id)) {
      await message.reply(PersonalityService.wrap('Bold attempt, but owner-only commands stay owner-only.', { user: message.author }));
      return true;
    }

    try {
      const context = { message, args, client: this.client, userDoc };
      const result = await command.handler(context);
      if (!result) return true;

      let response = result;
      let wrapContext = { user: message.author };

      if (response && typeof response === 'object' && !Array.isArray(response) && 'response' in response && !('content' in response)) {
        wrapContext = { ...wrapContext, ...(response.context || {}) };
        response = response.response;
      }

      const formatted = PersonalityService.wrap(response, wrapContext);
      await message.reply(formatted);
    } catch (error) {
      logger.error({ error: String(error), command: rawName }, 'Text command failed');
      await message.reply(PersonalityService.wrap('That command tripped over its own hype. Try again later.', { user: message.author }));
    }

    return true;
  }

  registerDefaults() {
    this.register('help', async ({ message }) => {
      const isOwner = this.ownerIds.has(message.author.id);
      const available = [...this.commands.values()]
        .filter(cmd => isOwner || !cmd.ownerOnly)
        .sort((a, b) => a.name.localeCompare(b.name));

      const lines = available.map(cmd => `• **${this.prefix}${cmd.name}** — ${cmd.description}${cmd.ownerOnly ? ' *(owner)*' : ''}`);
      return {
        response: `Here’s the current toolkit:\n${lines.join('\n')}`,
        context: { user: message.author, noSuffix: true }
      };
    }, { description: 'Show all available commands.' });

    this.register('joke', async () => randomFrom([...cryptoJokes, ...techFacts]), {
      description: 'Serve a crypto joke or borderline-useful fact.'
    });

    this.register('quip', async () => randomFrom(quickQuips), {
      description: 'Drop a quick quip.'
    });

    this.register('jab', async () => randomFrom(storyJabs), {
      description: 'Deliver a snarky jab.'
    });

    this.register('lore', async () => randomFrom(loreDrops), {
      description: 'Share a lore drop from HQ.'
    });

    this.register('chaos', async () => randomFrom(chaosEvents), {
      description: 'Unleash a chaos event.'
    });

    this.register('gmrank', async () => {
      const leaderboard = await CommunityEngagementService.getLeaderboard('gm', 10);
      if (!leaderboard.length) {
        return 'No GM data yet. Someone start the sunrise ritual.';
      }

      const lines = leaderboard.map((entry, index) => formatLeaderboardEntry(entry, index));
      return {
        response: `GM Leaderboard:\n${lines.join('\n')}`,
        context: { noSuffix: true }
      };
    }, { description: 'Show the top GM/GN grinders.' });

    this.register('achievements', async ({ message }) => {
      const achievements = await CommunityEngagementService.listAchievements(message.author.id);
      if (!achievements.length) {
        return 'No achievements… yet. Consider this your gentle nudge.';
      }

      const formatted = achievements
        .slice(0, 15)
        .map(a => `• **${a.label}** — ${a.description} *(unlocked ${new Date(a.unlockedAt).toLocaleDateString()})*`);

      return {
        response: `Flex report incoming:\n${formatted.join('\n')}`,
        context: { noSuffix: true }
      };
    }, { description: 'Show your unlocked achievements.' });

    this.register('meme', async ({ message }) => {
      const memeUrl = randomFrom(memeVault);
      const { unlocks } = await CommunityEngagementService.incrementMeme(message.author.id);
      const response = {
        content: `Deploying meme artillery: ${memeUrl}`
      };

      const context = { noSuffix: true };
      if (unlocks.length) {
        response.content += `\nAlso unlocked: ${unlocks.map(a => `**${a.label}**`).join(', ')}`;
      }

      return { response, context };
    }, { description: 'Request a meme drop from the vault.' });

    // Owner commands
    this.register('reset', async ({ message, args }) => {
      if (!message.mentions.users.size) {
        return 'Tag the user(s) you want to reset and specify optional scope (gm/gn/memes/all).';
      }

      const scopeArg = args.find(arg => ['gm', 'gn', 'memes', 'all'].includes(arg.toLowerCase()));
      const scope = scopeArg ? scopeArg.toLowerCase() : 'all';
      const users = [];

      for (const [, user] of message.mentions.users) {
        await CommunityEngagementService.resetUser(user.id, scope);
        users.push(`<@${user.id}>`);
      }

      return {
        response: `Reset ${scope.toUpperCase()} stats for ${users.join(', ')}.`,
        context: { noSuffix: true }
      };
    }, {
      ownerOnly: true,
      description: 'Reset community stats for tagged users.'
    });

    this.register('update', async ({ message }) => {
      const channelMention = message.mentions.channels.first();
      const result = await RandomChatterService.post(channelMention?.id);

      if (!result.ok) {
        return `Tried to fire an update but faceplanted (${result.reason}).`;
      }

      return {
        response: `Fresh broadcast deployed to <#${result.channelId}>.`,
        context: { noSuffix: true }
      };
    }, {
      ownerOnly: true,
      description: 'Force a random interjection immediately.'
    });

    this.register('toggleauto', async () => {
      const enabled = RandomChatterService.toggle();
      return enabled
        ? 'Auto-chatter back on. Brace for unsolicited wit.'
        : 'Auto-chatter paused. Silence… for now.';
    }, {
      ownerOnly: true,
      description: 'Toggle random interjections on/off.'
    });

    this.register('shadowban', async ({ message, args }) => {
      if (!message.mentions.users.size) {
        return 'Need a target to shadowban. Mention someone.';
      }

      const lift = args.some(arg => ['off', 'lift', 'undo'].includes(arg.toLowerCase()));
      const targets = [];
      for (const [, user] of message.mentions.users) {
        await CommunityEngagementService.shadowban(user.id, !lift);
        targets.push(`<@${user.id}>`);
      }

      return lift
        ? { response: `Shadowban lifted for ${targets.join(', ')}.`, context: { noSuffix: true } }
        : { response: `Shadowban applied to ${targets.join(', ')}. They can scream into the void now.`, context: { noSuffix: true } };
    }, {
      ownerOnly: true,
      description: 'Shadowban/unshadowban mentioned users.'
    });

    this.register('announce', async ({ message, args }) => {
      const channelMention = message.mentions.channels.first();
      if (!channelMention) {
        return 'Tag a channel to announce in. I can’t guess.';
      }

      const text = args.filter(arg => !arg.startsWith('<#')).join(' ');
      if (!text) {
        return 'Give me something worth announcing.';
      }

      const channel = await RandomChatterService.resolveChannel(channelMention.id);
      if (!channel) {
        return `Could not reach <#${channelMention.id}>. Double-check permissions.`;
      }

      await channel.send(PersonalityService.wrap(text, { noPrefix: true }));
      return {
        response: `Announcement deployed to <#${channel.id}>.`,
        context: { noSuffix: true }
      };
    }, {
      ownerOnly: true,
      description: 'Broadcast a custom announcement.'
    });

    this.register('dropbadge', async ({ message, args }) => {
      const badgeId = args.find(arg => !arg.startsWith('<@') && !arg.startsWith('<#'));
      const target = message.mentions.users.first();
      if (!badgeId || !target) {
        return 'Usage: !dropbadge @user badge-id';
      }

      await User.findOneAndUpdate(
        { discordId: target.id },
        { $addToSet: { badges: badgeId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return {
        response: `Badge **${badgeId}** dropped on <@${target.id}>.`,
        context: { noSuffix: true }
      };
    }, {
      ownerOnly: true,
      description: 'Manually grant a badge to a user.'
    });

    this.register('pullstats', async () => {
      const stats = await CommunityEngagementService.getCommunityStats();
      const lines = [
        `• Users tracked: ${stats.totalUsers}`,
        `• GM total: ${stats.totalGm}`,
        `• GN total: ${stats.totalGn}`,
        `• Meme drops: ${stats.totalMemes}`,
        `• Top GM streak: ${stats.topGmStreak}`,
        `• Top GN streak: ${stats.topGnStreak}`
      ];

      return {
        response: `Owner analytics hot off the press:\n${lines.join('\n')}`,
        context: { noSuffix: true }
      };
    }, {
      ownerOnly: true,
      description: 'Pull high-level community stats.'
    });
  }
}
