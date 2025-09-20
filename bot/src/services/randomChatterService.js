import { logger } from '../utils/logger.js';
import { Settings } from '../utils/settings.js';
import { randomFrom } from '../utils/botResponses.js';
import { PersonalityService } from './personalityService.js';

export class RandomChatterService {
  static client;
  static timer = null;
  static enabled = process.env.ENABLE_RANDOM_CHAT !== 'false';
  static channelCache = new Map();

  static initialize(client) {
    this.client = client;
    if (!Settings.chatterChannels.length) {
      logger.warn('No chatter channels configured. Random chatter disabled.');
      this.enabled = false;
      return;
    }

    if (this.enabled) {
      this.start();
    }
  }

  static start() {
    if (!this.client || this.timer) return;
    if (!Settings.chatterChannels.length) return;

    const intervalMs = Math.max(5, Settings.chatterIntervalMinutes || 45) * 60 * 1000;
    this.timer = setInterval(() => {
      this.post().catch(error => {
        logger.error({ error: String(error) }, 'Random chatter post failed');
      });
    }, intervalMs);

    // Kick off a delayed first post so the server warms up
    setTimeout(() => {
      this.post().catch(error => logger.error({ error: String(error) }, 'Initial chatter post failed'));
    }, Math.min(intervalMs, 60_000));

    logger.info({ intervalMs, channels: Settings.chatterChannels }, 'Random chatter service started');
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Random chatter service stopped');
  }

  static toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.enabled;
  }

  static async post(channelId) {
    if (!this.client || !this.enabled) return { ok: false, reason: 'disabled' };

    const targetChannelId = channelId || randomFrom(Settings.chatterChannels);
    if (!targetChannelId) return { ok: false, reason: 'no-channel' };

    const channel = await this.resolveChannel(targetChannelId);
    if (!channel) return { ok: false, reason: 'channel-missing' };

    const message = PersonalityService.randomInterjection();

    try {
      await channel.send(message);
      logger.debug({ channelId: channel.id }, 'Random chatter message sent');
      return { ok: true, channelId: channel.id };
    } catch (error) {
      logger.error({ error: String(error), channelId: targetChannelId }, 'Failed to send random chatter message');
      return { ok: false, reason: 'send-failed' };
    }
  }

  static async resolveChannel(channelId) {
    if (!this.client || !channelId) return null;
    if (this.channelCache.has(channelId)) return this.channelCache.get(channelId);

    try {
      let channel = this.client.channels.cache.get(channelId);
      if (!channel) {
        channel = await this.client.channels.fetch(channelId);
      }
      if (channel) {
        this.channelCache.set(channelId, channel);
      }
      return channel;
    } catch (error) {
      logger.error({ error: String(error), channelId }, 'Failed to resolve chatter channel');
      return null;
    }
  }
}
