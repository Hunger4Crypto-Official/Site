import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { Env } from '../utils/envGuard.js';
import { profileHandler } from './suites/profile.js';
import { rolesyncHandler } from './suites/rolesync.js';

const commands = [
  new SlashCommandBuilder().setName('profile').setDescription('Show your H4C profile & reputation.'),
  new SlashCommandBuilder().setName('rolesync').setDescription('Sync your roles from badges & HODL.')
].map(c => c.toJSON());

export async function loadSlashCommands(client) {
  const rest = new REST({ version: '10' }).setToken(Env.BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, Env.DISCORD_GUILD_ID), { body: commands });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      if (interaction.commandName === 'profile') return profileHandler(interaction);
      if (interaction.commandName === 'rolesync') return rolesyncHandler(interaction, client);
    } catch (e) {
      try { await interaction.reply({ content: 'Error occurred.', ephemeral: true }); } catch {}
    }
  });
}
