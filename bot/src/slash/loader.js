import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { Env } from '../utils/envGuard.js';
import { profileHandler } from './suites/profile.js';
import { rolesyncHandler } from './suites/rolesync.js';
import { emailHandler, emailRemoveHandler, emailStatusHandler } from './suites/email.js';

// Import the responses utility
import { randomFrom, quickQuips, chaosEvents, loreDrops, storyJabs } from '../utils/botResponses.js';

const commands = [
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show your H4C profile & reputation.'),
  new SlashCommandBuilder()
    .setName('rolesync')
    .setDescription('Sync your roles from badges & HODL.'),
  new SlashCommandBuilder()
    .setName('email')
    .setDescription('Manage your email subscription')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your email for $MemO updates')
        .addStringOption(option =>
          option
            .setName('email')
            .setDescription('Your email address')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove your email and unsubscribe')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your email subscription status')
    ),
  // Add the new quip command
  new SlashCommandBuilder()
    .setName('quip')
    .setDescription('Get a random bot quip or jab!')
].map(c => c.toJSON());

export async function loadSlashCommands(client) {
  const rest = new REST({ version: '10' }).setToken(Env.BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, Env.DISCORD_GUILD_ID), { body: commands });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      if (interaction.commandName === 'profile') {
        return profileHandler(interaction);
      }

      if (interaction.commandName === 'rolesync') {
        return rolesyncHandler(interaction, client);
      }

      if (interaction.commandName === 'email') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
          return emailHandler(interaction);
        } else if (subcommand === 'remove') {
          return emailRemoveHandler(interaction);
        } else if (subcommand === 'status') {
          return emailStatusHandler(interaction);
        }
      }

      // ADD THIS: handle /quip
      if (interaction.commandName === 'quip') {
        // Pick a random category
        const categories = [quickQuips, chaosEvents, loreDrops, storyJabs];
        const chosen = randomFrom(categories);
        const response = randomFrom(chosen);
        return interaction.reply({ content: response, ephemeral: false });
      }

    } catch (e) {
      // If you have a logger, use it; otherwise, use console.error
      if (typeof logger !== 'undefined') {
        logger.error({ error: String(e), command: interaction.commandName }, 'Slash command error');
      } else {
        console.error('Slash command error:', e);
      }
      try {
        await interaction.reply({ content: 'Error occurred.', ephemeral: true });
      } catch {}
    }
  });
}
