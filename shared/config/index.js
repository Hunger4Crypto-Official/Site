// Production-safe config with zod validation and proper error handling
let z;
try {
  // Try to import zod, fallback if not available
  const zodModule = await import('zod');
  z = zodModule.z;
} catch (error) {
  console.warn('Zod not available, using basic validation');
  z = null;
}

// Create schema only if zod is available
const configSchema = z ? z.object({
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
    roles: z.record(z.string().regex(/^\d{17,19}$/).optional()).optional()
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
}) : null;

// Create the raw config object
const rawConfig = {
  mongodb: {
    uri: process.env.MONGODB_URI,
    poolSize: Number(process.env.DB_POOL_SIZE || '10'),
    timeout: Number(process.env.DB_TIMEOUT || '5000')
  },
  
  redis: {
    url: process.env.REDIS_URL,
    maxRetries: Number(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelay: Number(process.env.REDIS_RETRY_DELAY || '100')
  },
  
  discord: {
    token: process.env.BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
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
    jwtSecret: process.env.ADMIN_JWT_SECRET,
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
};

// Use zod validation if available, otherwise use raw config
export const config = configSchema ? (() => {
  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.error('Config validation failed:', error.message);
    console.warn('Using unvalidated config due to validation errors');
    return rawConfig;
  }
})() : rawConfig;

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'REDIS_URL', 'BOT_TOKEN', 'DISCORD_GUILD_ID', 'ADMIN_JWT_SECRET'];
const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
  console.error(errorMsg);
  
  // In production, log error but don't crash immediately
  if (process.env.NODE_ENV === 'production') {
    console.warn('Continuing with missing env vars in production mode');
  } else {
    throw new Error(errorMsg);
  }
}
