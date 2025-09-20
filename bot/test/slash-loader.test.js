import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { createWrapReply, FALLBACK_REPLY } from '../src/slash/wrapReply.js';

const interactionFactory = () => ({
  user: { id: 'user-123' },
  reply: mock.fn(async () => {})
});

test('wrapReply falls back to a safe message when the response payload is empty', async () => {
  const wrapReply = createWrapReply(() => undefined);
  const interaction = interactionFactory();

  await wrapReply(interaction, undefined, {});

  assert.strictEqual(interaction.reply.mock.calls.length, 1);
  const [payload] = interaction.reply.mock.calls[0].arguments;
  assert.deepStrictEqual(payload, {
    content: FALLBACK_REPLY,
    ephemeral: undefined
  });
});
