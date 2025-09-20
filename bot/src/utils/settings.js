function parseCsv(value = '') {
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

export const Settings = {
  prefix: process.env.COMMAND_PREFIX || '!',
  ownerIds: new Set(parseCsv(process.env.BOT_OWNER_IDS || process.env.OWNER_IDS || '')),
  chatterIntervalMinutes: Number(process.env.CHATTER_INTERVAL_MINUTES || 45),
  chatterChannels: parseCsv(process.env.CHATTER_CHANNEL_IDS || process.env.CHATBOX_CHANNEL_ID || ''),
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || '',
  activityChannelId: process.env.ACTIVITY_CHANNEL_ID || '',
  chatboxChannelId: process.env.CHATBOX_CHANNEL_ID || '',
  gmCooldownHours: Number(process.env.GM_COOLDOWN_HOURS || 4),
  gnCooldownHours: Number(process.env.GN_COOLDOWN_HOURS || 4),
  resurrectionThresholdHours: Number(process.env.RESURRECTION_THRESHOLD_HOURS || 72),
  allowExtendedGreetings: process.env.ALLOW_EXTENDED_GREETINGS === 'true',
  allowEmojiGreetings: process.env.ALLOW_EMOJI_GREETINGS === 'true',
  allowMultiLanguageGreetings: process.env.ALLOW_MULTI_LANGUAGE_GREETINGS === 'true'
};
