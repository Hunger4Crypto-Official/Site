import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { Env } from '../utils/envGuard.js';
import { profileHandler } from './suites/profile.js';
import { rolesyncHandler } from './suites/rolesync.js';
import { emailHandler, emailRemoveHandler, emailStatusHandler } from './suites/email.js';

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
    )
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
      
    } catch (e) {
      logger.error({ error: String(e), command: interaction.commandName }, 'Slash command error');
      try { 
        await interaction.reply({ content: 'Error occurred.', ephemeral: true }); 
      } catch {}
    }
  });
}
