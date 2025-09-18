import { CrossChainService } from '../../services/crossChainService.js';
import { criteria } from '../../../../shared/criteria.js';

export async function profileHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;

  const rep = await CrossChainService.calculateCrossChainReputation(userId).catch(() => ({ score: 0, details: {} }));
  const memo = criteria.assets.memo.asa_id;

  const content =
    `**Your Reputation (v2):** ${rep.score}\n` +
    `• ETH: ${rep.details.eth?.total ?? 0}\n` +
    `• SOL: ${rep.details.sol?.total ?? 0}\n` +
    `• Wallets: ${rep.wallets?.ethereum || '—'} / ${rep.wallets?.solana || '—'}\n` +
    `• ASA: ${memo}`;

  return interaction.editReply({ content });
}
