import { createClient } from 'ioredis';
import { Env } from './envGuard.js';
export const redis = new createClient(Env.REDIS_URL);
redis.on('error', err => console.error('Redis error', err));
