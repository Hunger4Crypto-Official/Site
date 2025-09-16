import { RoleManagementService } from '../../services/roleManagementService.js';

export async function rolesyncHandler(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (!guild) return interaction.editReply('Guild not ready.');
  const out = await RoleManagementService.syncHodlRoles(guild, interaction.user.id);
  return interaction.editReply(`Roles synced: ${out?.changed ? 'updated' : 'no change'}.`);
}
