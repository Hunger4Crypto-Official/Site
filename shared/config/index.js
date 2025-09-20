import { z } from 'zod';
import { env } from './environment.js';

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const configSchema = z.object({
  mongodb: z.object({
    uri: z.string().url(),
    poolSize: z.number().int().positive().default(10),
    timeout: z.number().int().positive().default(5000)
  }),
  redis: z.object({
    url: z.string().url(),
    maxRetries: z.number().int().nonnegative().default(3),
    retryDelay: z.number().int().nonnegative().default(100)
  }),
  discord: z.object({
    token: z.string().min(1),
    guildId: z.string().regex(/\d{17,19}/),
    roles: z.record(z.string().regex(/\d{17,19}/)).partial().default({})
  }),
  security: z.object({
    jwtSecret: z.string().min(1),
    adminIpAllowlist: z.array(z.string()).default([]),
    rateLimits: z.object({
      public: z.object({ windowMs: z.number().int().positive(), max: z.number().int().positive() }),
      admin: z.object({ windowMs: z.number().int().positive(), max: z.number().int().positive() })
    })
  }),
  performance: z.object({
    autoAwards: z.object({
      buckets: z.number().int().positive().default(10),
      bucketPeriodMin: z.number().int().positive().default(5),
      scanConcurrency: z.number().int().positive().default(3),
      scanSpacingMs: z.number().int().positive().default(1000)
    }),
    caching: z.object({
      balanceTtlMs: z.number().int().positive().default(60000),
      reputationTtlSecs: z.number().int().positive().default(900),
      lpSnapshotTtlSecs: z.number().int().positive().default(7200)
    })
  })
});

const rawConfig = {
  mongodb: {
    uri: env.MONGODB_URI,
    poolSize: numberFromEnv(process.env.DB_POOL_SIZE, 10),
    timeout: numberFromEnv(process.env.DB_TIMEOUT, 5000)
  },
  redis: {
    url: env.REDIS_URL,
    maxRetries: numberFromEnv(process.env.REDIS_MAX_RETRIES, 3),
    retryDelay: numberFromEnv(process.env.REDIS_RETRY_DELAY, 100)
  },
  discord: {
    token: env.BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    roles: {
      citizen: process.env.ROLE_CITIZEN_ID,
      shrimp: process.env.ROLE_HODL_SHRIMP_ID,
      crab: process.env.ROLE_HODL_CRAB_ID,
      fish: process.env.ROLE_HODL_FISH_ID,
      dolphin: process.env.ROLE_HODL_DOLPHIN_ID,
      shark: process.env.ROLE_HODL_SHARK_ID,
      whale: process.env.ROLE_HODL_WHALE_ID,
      titan: process.env.ROLE_HODL_TITAN_ID
    }
  },
  security: {
    jwtSecret: env.ADMIN_JWT_SECRET,
    adminIpAllowlist: (process.env.ADMIN_IP_ALLOWLIST || '').split(',').filter(Boolean),
    rateLimits: {
      public: {
        windowMs: numberFromEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000),
        max: numberFromEnv(process.env.RATE_LIMIT_MAX_TOKENS, 120)
      },
      admin: {
        windowMs: numberFromEnv(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 60000),
        max: numberFromEnv(process.env.ADMIN_RATE_LIMIT_MAX_TOKENS, 30)
      }
    }
  },
  performance: {
    autoAwards: {
      buckets: numberFromEnv(process.env.BUCKETS, 10),
      bucketPeriodMin: numberFromEnv(process.env.BUCKET_PERIOD_MIN, 5),
      scanConcurrency: numberFromEnv(process.env.SCAN_CONCURRENCY, 3),
      scanSpacingMs: numberFromEnv(process.env.SCAN_SPACING_MS, 1000)
    },
    caching: {
      balanceTtlMs: numberFromEnv(process.env.ALG_BALANCE_TTL_MS, 60000),
      reputationTtlSecs: numberFromEnv(process.env.REP_V2_TTL_SECS, 900),
      lpSnapshotTtlSecs: numberFromEnv(process.env.LP_SNAPSHOT_TTL_SECS, 7200)
    }
  }
};

const validateConfig = () => {
  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.error('Config validation failed:', error);
    return rawConfig;
  }
};

export const config = validateConfig();

const requiredEnvVars = ['MONGODB_URI', 'REDIS_URL', 'BOT_TOKEN', 'DISCORD_GUILD_ID', 'ADMIN_JWT_SECRET'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  const message = `Missing required environment variables: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
  } else {
    throw new Error(message);
  }
}
