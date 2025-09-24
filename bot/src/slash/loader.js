import { REST, Routes, SlashCommandBuilder } from 'discord.js';

import { Env } from '../utils/envGuard.js';
import { profileHandler } from './suites/profile.js';
import { rolesyncHandler } from './suites/rolesync.js';
import { emailHandler, emailRemoveHandler, emailStatusHandler } from './suites/email.js';
import {
  randomFrom,
  quickQuips,
  chaosEvents,
  loreDrops,
  storyJabs,
  gmResponses,
  cryptoJokes,
  techFacts,
  memeVault,
} from '../utils/botResponses.js';
import { PersonalityService } from '../services/personalityService.js';
import { CommunityEngagementService } from '../services/communityEngagementService.js';
import { logger } from '../utils/logger.js';
import { createWrapReply } from './wrapReply.js';

const wrapReply = createWrapReply((response, context = {}) => PersonalityService.wrap(response, context));

function buildDefinitions(client) {
  return [
    {
      name: 'gm',
      builder: new SlashCommandBuilder().setName('gm').setDescription('Log a sarcastic GM and keep your streak alive.'),
      execute: async (interaction) => {
        const mockMessage = { author: interaction.user, channelId: interaction.channelId };
        const result = await CommunityEngagementService.handleGreeting(mockMessage, 'gm');
        let content = randomFrom(gmResponses) ?? 'gm';

        if (result?.achievements?.length) {
          const unlocked = result.achievements.map((a) => `**${a.label}**`).join(', ');
          content += `\nAchievement unlocked: ${unlocked}`;
        }

        await wrapReply(interaction, content);
      },
    },
    {
      name: 'gn',
      builder: new SlashCommandBuilder().setName('gn').setDescription('Clock out with style and track your GN streak.'),
      execute: async (interaction) => {
        const mockMessage = { author: interaction.user, channelId: interaction.channelId };
        const result = await CommunityEngagementService.handleGreeting(mockMessage, 'gn');
        const responses = [
          'Sleep protocol engaged. Try not to dream about chart lines.',
          'Logging you off. May your bags inflate overnight.',
          'Night, legend. Your streak is safe—for now.',
          'Power nap authorized. Return with alpha.',
        ];
        let content = randomFrom(responses) ?? 'gn';

        if (result?.achievements?.length) {
          const unlocked = result.achievements.map((a) => `**${a.label}**`).join(', ');
          content += `\nNight shift unlocked: ${unlocked}`;
        }

        await wrapReply(interaction, content);
      },
    },
    {
      name: 'joke',
      builder: new SlashCommandBuilder().setName('joke').setDescription('Request a crypto joke or fact.'),
      execute: async (interaction) => {
        const pool = [...cryptoJokes, ...techFacts];
        await wrapReply(interaction, randomFrom(pool) ?? 'All circuits empty. Try again.');
      },
    },
    {
      name: 'quip',
      builder: new SlashCommandBuilder().setName('quip').setDescription('Grab a random quip or jab.'),
      execute: async (interaction) => {
        const categories = [quickQuips, chaosEvents, loreDrops, storyJabs];
        const bucket = randomFrom(categories) ?? [];
        await wrapReply(interaction, randomFrom(bucket) ?? 'The snark generator is cooling down.');
      },
    },
    {
      name: 'jab',
      builder: new SlashCommandBuilder().setName('jab').setDescription('Ask the bot to roast you just a little.'),
      execute: async (interaction) => wrapReply(interaction, randomFrom(storyJabs) ?? 'Consider yourself gently roasted.'),
    },
    {
      name: 'lore',
      builder: new SlashCommandBuilder().setName('lore').setDescription('Drop a lore snippet straight from HQ.'),
      execute: async (interaction) => wrapReply(interaction, randomFrom(loreDrops) ?? 'Lore uplink unstable. Try again.'),
    },
    {
      name: 'chaos',
      builder: new SlashCommandBuilder().setName('chaos').setDescription('Summon a random chaos event.'),
      execute: async (interaction) => wrapReply(interaction, randomFrom(chaosEvents) ?? 'Chaos temporarily contained.'),
    },
    {
      name: 'meme',
      builder: new SlashCommandBuilder().setName('meme').setDescription('Drop a meme from the vault.'),
      execute: async (interaction) => {
        const memeUrl = randomFrom(memeVault);
        const { unlocks = [] } = await CommunityEngagementService.incrementMeme(interaction.user.id);
        let content = memeUrl ? `Deploying meme artillery: ${memeUrl}` : 'Meme vault empty. Insert alpha.';

        if (unlocks.length) {
          content += `\nAlso unlocked: ${unlocks.map((a) => `**${a.label}**`).join(', ')}`;
        }

        await wrapReply(interaction, content, { noSuffix: true });
      },
    },
    {
      name: 'achievements',
      builder: new SlashCommandBuilder().setName('achievements').setDescription('Review your unlocked achievements.'),
      execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const achievements = await CommunityEngagementService.listAchievements(interaction.user.id);

        if (!achievements.length) {
          return interaction.editReply('No achievements yet—but the grind starts now.');
        }

        const lines = achievements
          .slice(0, 15)
          .map((a) => `• **${a.label}** — ${a.description} *(unlocked ${new Date(a.unlockedAt).toLocaleDateString()})*`);

        return interaction.editReply(
          PersonalityService.wrap(`Flex report incoming:\n${lines.join('\n')}`, { disableSarcasm: true }),
        );
      },
    },
    {
      name: 'gmrank',
      builder: new SlashCommandBuilder().setName('gmrank').setDescription('See the GM/GN leaderboard.'),
      execute: async (interaction) => {
        const leaderboard = await CommunityEngagementService.getLeaderboard('gm', 10);
        if (!leaderboard.length) {
          return wrapReply(interaction, 'No GM data yet. Someone start the streak.', { noSuffix: true });
        }

        const lines = leaderboard.map(
          (entry, index) => `${index + 1}. <@${entry.discordId}> — ${entry.community?.gmCount || 0} GM / ${entry.community?.gnCount || 0} GN`,
        );

        await wrapReply(interaction, `GM Leaderboard:\n${lines.join('\n')}`, { noSuffix: true });
      },
    },
    {
      name: 'profile',
      builder: new SlashCommandBuilder().setName('profile').setDescription('Show your H4C profile & reputation.'),
      execute: profileHandler,
    },
    {
      name: 'rolesync',
      builder: new SlashCommandBuilder().setName('rolesync').setDescription('Sync your roles from badges & HODL.'),
      execute: (interaction) => rolesyncHandler(interaction, client),
    },
    {
      name: 'email',
      builder: new SlashCommandBuilder()
        .setName('email')
        .setDescription('Manage your email subscription')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('set')
            .setDescription('Set your email for $MemO updates')
            .addStringOption((option) => option.setName('email').setDescription('Your email address').setRequired(true)),
        )
        .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove your email and unsubscribe'))
        .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Check your email subscription status')),
      execute: async (interaction) => {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'set') return emailHandler(interaction);
        if (subcommand === 'remove') return emailRemoveHandler(interaction);
        if (subcommand === 'status') return emailStatusHandler(interaction);
        return interaction.reply({ content: 'Unsupported email action.', ephemeral: true });
      },
    },
  ];
}

export async function loadSlashCommands(client) {
  const rest = new REST({ version: '10' }).setToken(Env.BOT_TOKEN);
  const definitions = buildDefinitions(client);

  await rest.put(Routes.applicationGuildCommands(client.user.id, Env.DISCORD_GUILD_ID), {
    body: definitions.map((def) => def.builder.toJSON()),
  });

  if (!client.slashCommands || typeof client.slashCommands.set !== 'function') {
    client.slashCommands = new Map();
  } else if (typeof client.slashCommands.clear === 'function') {
    client.slashCommands.clear();
  }

  for (const def of definitions) {
    client.slashCommands.set(def.name, def);
  }

  if (!client.__h4cSlashHandlerBound) {
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = client.slashCommands.get(interaction.commandName);
      if (!command) {
        logger.warn(
          {
            command: interaction.commandName,
            user: interaction.user.tag,
          },
          'Unknown slash command attempted',
        );
        return;
      }

      const startTime = Date.now();

      try {
        await command.execute(interaction);
        const duration = Date.now() - startTime;
        logger.info(
          {
            command: interaction.commandName,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
            duration,
          },
          'Slash command executed successfully',
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          {
            error,
            command: interaction.commandName,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
            duration,
          },
          'Slash command execution failed',
        );

        const reply = {
          content: 'There was an error executing this command. Please try again later.',
          ephemeral: true,
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          logger.error(replyError, 'Failed to send slash command error response');
        }
      }
    });

    client.__h4cSlashHandlerBound = true;
  }

  logger.info({ count: definitions.length }, 'Slash commands registered');
}
