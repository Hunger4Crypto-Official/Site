import { logger } from '../utils/logger.js';

export class GreetingDetectionService {
  constructor() {
    this.corePatterns = {
      gm: /^gm\b/i,
      gn: /^gn\b/i
    };

    this.extendedPatterns = {
      gm: [
        /^(gm|good morning|mornin|morning)\b/i,
        /^(wassup|sup|hey|hi|yo)\s+(gm|morning)/i,
        /^(wgmi\s+)?gm\b/i,
        /gm\s*(fam|frens|legends|crypto|web3|everyone|all|squad|team)\b/i
      ],
      gn: [
        /^(gn|good night|goodnight|nite|night)\b/i,
        /^(alright\s+)?(gn|night)\b/i,
        /^(peace\s+out\s+)?(gn|night)\b/i,
        /gn\s*(fam|frens|legends|crypto|web3|everyone|all|squad|team)\b/i
      ]
    };

    this.emojiPatterns = {
      gm: [
        /^[\s🌅🌄☀️🌞🌇🔆⚡🚀💎]+$/,
        /^(gm|morning)[\s🌅🌄☀️🌞🌇🔆⚡🚀💎]+$/i
      ],
      gn: [
        /^[\s🌙🌛🌜🌚🌝⭐✨💤😴💜]+$/,
        /^(gn|night)[\s🌙🌛🌜🌚🌝⭐✨💤😴💜]+$/i
      ]
    };

    this.timeBasedHints = {
      morningHours: [6, 7, 8, 9, 10, 11],
      nightHours: [21, 22, 23, 0, 1, 2]
    };

    this.multiLangPatterns = {
      gm: [
        /^(buenos días|bom dia|bonjour|guten morgen|buongiorno)/i,
        /^(おはよう|早上好|صباح الخير|добрый день)/i
      ],
      gn: [
        /^(buenas noches|boa noite|bonne nuit|gute nacht|buonanotte)/i,
        /^(おやすみ|晚安|ليلة سعيدة|спокойной ночи)/i
      ]
    };
  }

  detectGreeting(content, options = {}) {
    if (typeof content !== 'string') return null;

    const {
      useExtended = false,
      useEmoji = false,
      useMultiLang = false,
      userTimezone = null
    } = options;

    const normalizedContent = content.trim();
    if (!normalizedContent) return null;

    for (const [type, pattern] of Object.entries(this.corePatterns)) {
      if (pattern.test(normalizedContent)) {
        return {
          type,
          confidence: 'high',
          method: 'core_pattern',
          matched: normalizedContent.match(pattern)?.[0] || ''
        };
      }
    }

    if (useExtended) {
      for (const [type, patterns] of Object.entries(this.extendedPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(normalizedContent)) {
            return {
              type,
              confidence: 'medium',
              method: 'extended_pattern',
              matched: normalizedContent.match(pattern)?.[0] || ''
            };
          }
        }
      }
    }

    if (useEmoji) {
      for (const [type, patterns] of Object.entries(this.emojiPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(normalizedContent)) {
            return {
              type,
              confidence: 'low',
              method: 'emoji_pattern',
              matched: normalizedContent
            };
          }
        }
      }
    }

    if (useMultiLang) {
      for (const [type, patterns] of Object.entries(this.multiLangPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(normalizedContent)) {
            return {
              type,
              confidence: 'medium',
              method: 'multilang_pattern',
              matched: normalizedContent.match(pattern)?.[0] || ''
            };
          }
        }
      }
    }

    if (userTimezone && this.shouldUseTimeHints(normalizedContent)) {
      const hint = this.getTimeBasedHint(userTimezone);
      if (hint) {
        return {
          type: hint,
          confidence: 'very_low',
          method: 'time_hint',
          matched: normalizedContent
        };
      }
    }

    return null;
  }

  shouldUseTimeHints(content) {
    const ambiguousPatterns = [
      /^(hey|hi|hello|wassup|sup|yo)[\s!.]*$/i,
      /^[\s🌅🌙⭐✨]+$/,
      /^(morning|night)[\s!.]*$/i
    ];

    return ambiguousPatterns.some(pattern => pattern.test(content));
  }

  getTimeBasedHint(timezone) {
    logger.debug({ timezone }, 'Time-based greeting hints requested but not implemented');
    return null;
  }

  static getDetectionConfig(serverSettings = {}) {
    return {
      useExtended: serverSettings.allowExtendedGreetings ?? false,
      useEmoji: serverSettings.allowEmojiGreetings ?? false,
      useMultiLang: serverSettings.allowMultiLanguageGreetings ?? false,
      userTimezone: null
    };
  }
}
