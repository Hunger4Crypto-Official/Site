export const FALLBACK_REPLY = 'Apologies, I blanked on a comeback. Try again in a sec.';

export function createWrapReply(wrapFn = (value) => value) {
  return function wrapReply(interaction, response, context = {}) {
    const payload = wrapFn(response, { user: interaction.user, ...context });
    const safePayload = payload ?? FALLBACK_REPLY;

    if (typeof safePayload === 'string') {
      return interaction.reply({ content: safePayload, ephemeral: context.ephemeral });
    }

    if (safePayload && typeof safePayload === 'object') {
      return interaction.reply({ ...safePayload, ephemeral: context.ephemeral });
    }

    return interaction.reply({ content: String(safePayload), ephemeral: context.ephemeral });
  };
}
