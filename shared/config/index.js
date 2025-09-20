import { z } from 'zod';
import { env } from './environment.js';

const configSchema = z.object({
  mongodb: z.object({
    uri: z.string().url(),
    poolSize: z.number().default(10),
    timeout: z.number().default(5000)
  }),
  
  redis: z.object({
    url: z.string().url(),
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(100)
  }),
  
  discord: z.object({
    token: z.string().min(50),
    guildId: z.string().regex(/^\d{17,19}$/),
    roles: z.record(z.string().regex(/^\d{17,19}$/))
  }),
  
  security: z.object({
    jwtSecret: z.string().min(32),
    adminIpAllowlist: z.array(z.string()).default([]),
    rateLimits: z.object({
      public: z.object({ windowMs: z.number(), max: z.number() }),
      admin: z.object({ windowMs: z.number(), max: z.number() })
    })
  }),

  performance: z.object({
    autoAwards: z.object({
      buckets: z.number().default(10),
      bucketPeriodMin: z.number().default(5),
      scanConcurrency: z.number().default(3),
      scanSpacingMs: z.number().default(1000)
    }),
    caching: z.object({
      balanceTtlMs: z.number().default(60000),
      reputationTtlSecs: z.number().default(900),
      lpSnapshotTtlSecs: z.number().default(7200)
    })
  })
});

export const config = configSchema.parse({
  mongodb: {
    uri: env.MONGODB_URI,
    poolSize: Number(process.env.DB_POOL_SIZE || '10'),
    timeout: Number(process.env.DB_TIMEOUT || '5000')
  },

  redis: {
    url: env.REDIS_URL,
    maxRetries: Number(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelay: Number(process.env.REDIS_RETRY_DELAY || '100')
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
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        max: Number(process.env.RATE_LIMIT_MAX_TOKENS || '120')
      },
      admin: {
        windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || '60000'),
        max: Number(process.env.ADMIN_RATE_LIMIT_MAX_TOKENS || '30')
      }
    }
  },

  performance: {
    autoAwards: {
      buckets: Number(process.env.BUCKETS || '10'),
      bucketPeriodMin: Number(process.env.BUCKET_PERIOD_MIN || '5'),
      scanConcurrency: Number(process.env.SCAN_CONCURRENCY || '3'),
      scanSpacingMs: Number(process.env.SCAN_SPACING_MS || '1000')
    },
    caching: {
      balanceTtlMs: Number(process.env.ALG_BALANCE_TTL_MS || '60000'),
      reputationTtlSecs: Number(process.env.REP_V2_TTL_SECS || '900'),
      lpSnapshotTtlSecs: Number(process.env.LP_SNAPSHOT_TTL_SECS || '7200')
    }
  }
});
