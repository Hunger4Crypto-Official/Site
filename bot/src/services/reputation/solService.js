import fetch from 'node-fetch';
import { scoreLog } from './normalize.js';

const SOL_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ENABLED = !!process.env.SOLANA_RPC_URL;

async function solRPC(method, params = []) {
  const res = await fetch(SOL_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  }).catch(() => null);
  if (!res || !res.ok) throw new Error('SOL_RPC_UNAVAILABLE');
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'SOL_RPC_ERROR');
  return json.result;
}

export async function getSolSignals(address) {
  if (!ENABLED) return { sol: 0, txCount: 0, ageDays: 0, disabled: true };
  const balanceLamports = await solRPC('getBalance', [address]).catch(() => null);
  const sol = (balanceLamports?.value || 0) / 1e9;
  const sigs = await solRPC('getSignaturesForAddress', [address, { limit: 20 }]).catch(() => null);
  const txCount = Array.isArray(sigs) ? sigs.length : 0;
  return { sol, txCount, ageDays: 0, disabled: false };
}

export async function getSolScoreV2(address) {
  const s = await getSolSignals(address);
  const W_BAL = 50, W_TXS = 30, W_AGE = 20;

  const balScore = scoreLog(s.sol, 0.5, W_BAL);
  const txScore  = scoreLog(s.txCount, 5, W_TXS);
  const ageScore = 0;

  const total = Math.round(balScore + txScore + ageScore);
  return { total, details: s, weights: { W_BAL, W_TXS, W_AGE } };
}
