import { logger } from '../utils/logger.js';
import { Settings } from '../utils/settings.js';
import { randomFrom, cryptoJokes, techFacts } from '../utils/botResponses.js';
import { PersonalityService } from './personalityService.js';

export class RandomChatterService {
  static client;
  static timer = null;
  static enabled = process.env.ENABLE_RANDOM_CHAT !== 'false';
  static channelCache = new Map();
  static scheduledDrops = [];
  static dailyResetTimer = null;

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

    const intervalMs = Math.max(5, Number.isFinite(Settings.chatterIntervalMinutes) ? Settings.chatterIntervalMinutes : 45) * 60 * 1000;
    this.timer = setInterval(() => {
      this.post().catch(error => {
        logger.error({ error: String(error) }, 'Random chatter post failed');
      });
    }, intervalMs);

    // Kick off a delayed first post so the server warms up
    setTimeout(() => {
      this.post().catch(error => logger.error({ error: String(error) }, 'Initial chatter post failed'));
    }, Math.min(intervalMs, 60_000));

    this.scheduleDailyDrops();

    logger.info({ intervalMs, channels: Settings.chatterChannels }, 'Random chatter service started');
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.clearScheduledDrops();
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

    return this.sendToChannel(targetChannelId, PersonalityService.randomInterjection(), 'random');
  }

  static async postFromPool(pool, type) {
    if (!Array.isArray(pool) || pool.length === 0) {
      return { ok: false, reason: 'empty-pool' };
    }

    const content = randomFrom(pool);
    if (!content) {
      return { ok: false, reason: 'empty-pool' };
    }

    const targetChannelId = randomFrom(Settings.chatterChannels);
    if (!targetChannelId) {
      return { ok: false, reason: 'no-channel' };
    }

    const prefix = type === 'tech-fact'
      ? 'Tech signal incoming:'
      : type === 'crypto-joke'
        ? 'Crypto joke drop:'
        : 'Broadcast:';

    const message = PersonalityService.wrap(`${prefix} ${content}`, { noPrefix: true, noSuffix: true });
    return this.sendToChannel(targetChannelId, message, type);
  }

  static async sendToChannel(channelId, message, contextType = 'random') {
    const channel = await this.resolveChannel(channelId);
    if (!channel) return { ok: false, reason: 'channel-missing' };

    try {
      await channel.send(message);
      logger.debug({ channelId: channel.id, type: contextType }, 'Random chatter message sent');
      return { ok: true, channelId: channel.id };
    } catch (error) {
      logger.error({ error: String(error), channelId, type: contextType }, 'Failed to send random chatter message');
      return { ok: false, reason: 'send-failed' };
    }
  }

  static scheduleDailyDrops(now = new Date()) {
    this.clearScheduledDrops();

    if (!this.enabled || !this.client) {
      return;
    }

    if (!Settings.chatterChannels.length) {
      logger.warn('No chatter channels configured. Skipping scheduled drops.');
      return;
    }

    const window = this.getDailyWindow(now);
    const tasks = [
      { count: Settings.jokeDropsPerDay, pool: cryptoJokes, type: 'crypto-joke' },
      { count: Settings.techFactDropsPerDay, pool: techFacts, type: 'tech-fact' }
    ];

    for (const task of tasks) {
      if (!Array.isArray(task.pool) || task.pool.length === 0) {
        logger.debug({ type: task.type }, 'Skipping scheduled drop because pool is empty');
        continue;
      }

      const drops = this.generateUpcomingTimes(task.count, now, window);
      for (const at of drops) {
        const delay = at.getTime() - Date.now();
        if (delay <= 0) continue;
        const timer = setTimeout(() => {
          this.postFromPool(task.pool, task.type).catch(error => {
            logger.error({ error: String(error), type: task.type }, 'Scheduled drop failed');
          });
        }, delay);
        this.scheduledDrops.push({ timer, type: task.type, scheduledFor: at });
      }
    }

    const midnight = new Date(window.end.getTime());
    midnight.setHours(24, 0, 0, 0);
    const resetDelay = midnight.getTime() - now.getTime();
    const minDelay = 5 * 60 * 1000; // reschedule at least 5 minutes in the future
    this.dailyResetTimer = setTimeout(() => this.scheduleDailyDrops(), Math.max(resetDelay, minDelay));

    if (this.scheduledDrops.length) {
      logger.info({
        dropsScheduled: this.scheduledDrops.length,
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString()
      }, 'Scheduled daily chatter drops');
    }
  }

  static clearScheduledDrops() {
    for (const entry of this.scheduledDrops) {
      clearTimeout(entry.timer);
    }
    this.scheduledDrops = [];

    if (this.dailyResetTimer) {
      clearTimeout(this.dailyResetTimer);
      this.dailyResetTimer = null;
    }
  }

  static getDailyWindow(now = new Date()) {
    const startHour = Number.isFinite(Settings.dropWindowStartHour) ? Settings.dropWindowStartHour : 9;
    const endHour = Number.isFinite(Settings.dropWindowEndHour) ? Settings.dropWindowEndHour : 22;

    const start = new Date(now);
    start.setHours(startHour, 0, 0, 0);

    let end = new Date(now);
    end.setHours(endHour, 0, 0, 0);
    if (end <= start) {
      end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  static generateUpcomingTimes(count, now, window) {
    const results = [];
    const targetCount = Math.max(0, Number(count) || 0);
    if (targetCount === 0) return results;

    const startMs = window.start.getTime();
    const endMs = window.end.getTime();
    const nowMs = now.getTime();
    const duration = endMs - startMs;
    if (duration <= 0) return results;

    const unique = new Set();
    const attempts = Math.max(targetCount * 4, 8);
    for (let attempt = 0; attempt < attempts && unique.size < targetCount; attempt += 1) {
      const candidate = startMs + Math.random() * duration;
      if (candidate > nowMs) {
        unique.add(Math.round(candidate));
      }
    }

    if (unique.size < targetCount) {
      const step = duration / (targetCount + 1);
      for (let i = 1; unique.size < targetCount; i += 1) {
        const candidate = startMs + step * i;
        if (candidate > nowMs) {
          unique.add(Math.round(candidate));
        }
      }
    }

    return Array.from(unique)
      .sort((a, b) => a - b)
      .map(timestamp => new Date(timestamp));
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
