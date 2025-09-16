import fetch from 'node-fetch';
import { redis } from './redisClient.js';
import { Env } from './envGuard.js';
import { budgeted } from './rate.js';
import { metricsRecordIndexer } from '../middleware/metrics.js';

const BASE = (process.env.NODELY_INDEXER_URL || 'https://mainnet-api.4160.nodely.dev').replace(/\/+$/, '');
const API_KEY = process.env.NODELY_INDEXER_API_KEY || null;
const TTL_MS = Env.ALGORAND_BALANCE_TTL_MS || Env.ALG_BALANCE_TTL_MS || 60000;

async function idxGet(path, qs = {}) {
  const url = new URL(`${BASE}/v2${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(qs).forEach(([k, v]) => (v !== undefined && v !== null) && url.searchParams.set(k, String(v)));
  const headers = { accept: 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const res = await fetch(url.toString(), { headers, timeout: 10000 }).catch(() => null);
  if (!res) {
    metricsRecordIndexer(false, 0);
    throw new Error('HTTP_UNREACHABLE');
  }
  metricsRecordIndexer(res.ok, res.status);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP_${res.status}:${txt.slice(0,120)}`);
  }
  return res.json();
}

async function readAssetBalance(address, asaId) {
  const data = await budgeted(() => idxGet(`/accounts/${address}`));
  const assets = data?.account?.assets || [];
  const match = assets.find(a => Number(a['asset-id']) === Number(asaId));
  return match?.amount ? Number(match.amount) : 0;
}

export const algoClient = {
  async getAssetBalance(address, asaId) {
    const key = `algo:bal:${address}:${asaId}`;
    const cached = await redis.hgetall(key);
    const now = Date.now();
    if (cached?.amount && cached.ts && (now - Number(cached.ts)) < TTL_MS) {
      return Number(cached.amount);
    }
    const amount = await readAssetBalance(address, asaId).catch(() => Number(cached?.amount || 0));
    await redis.hset(key, { amount: amount, ts: Date.now() });
    await redis.expire(key, Math.ceil(TTL_MS / 1000));
    return amount;
  }
};
