import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),

  BOT_TOKEN: z.string().min(50),
  DISCORD_GUILD_ID: z.string().regex(/^\d{17,19}$/),

  ADMIN_JWT_SECRET: z.string().min(32),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  ALGORAND_NODE_URL: z.string().url().default('https://mainnet-api.algonode.cloud'),
  NODELY_INDEXER_URL: z.string().url().default('https://mainnet-idx.algonode.cloud')
});

export const env = environmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL,
  BOT_TOKEN: process.env.BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  ALGORAND_NODE_URL: process.env.ALGORAND_NODE_URL,
  NODELY_INDEXER_URL: process.env.NODELY_INDEXER_URL
});

export { environmentSchema };
