import fetch from 'node-fetch';
import { scoreLog, scoreLinear } from './normalize.js';

const ETH_RPC = process.env.ETHEREUM_RPC_URL || '';
const ENABLED = !!ETH_RPC;

async function ethRPC(method, params = []) {
  const res = await fetch(ETH_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  }).catch(() => null);
  if (!res || !res.ok) throw new Error('ETH_RPC_UNAVAILABLE');
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'ETH_RPC_ERROR');
  return json.result;
}

export async function getEthSignals(address) {
  if (!ENABLED) {
    const tail = parseInt(address?.slice?.(-4) || '0', 16) || 0;
    return { balEth: tail/5000, txCount: Math.floor(tail/10), hasCode: false, ageDays: 0, disabled: true };
  }
  const [balHex, txCountHex, code] = await Promise.all([
    ethRPC('eth_getBalance', [address, 'latest']),
    ethRPC('eth_getTransactionCount', [address, 'latest']),
    ethRPC('eth_getCode', [address, 'latest'])
  ]);

  const wei = BigInt(balHex || '0x0');
  const balEth = Number(wei) / 1e18;
  const txCount = parseInt(txCountHex || '0x0', 16) || 0;
  const hasCode = !!(code && code !== '0x');
  return { balEth, txCount, hasCode, ageDays: 0, disabled: false };
}

export async function getEthScoreV2(address) {
  const s = await getEthSignals(address);
  const W_BAL = 45, W_TXS = 35, W_CODE = 10, W_AGE = 10;

  const balScore = scoreLog(s.balEth, 0.5, W_BAL);
  const txScore  = scoreLog(s.txCount, 10, W_TXS);
  const codeScore = s.hasCode ? W_CODE : 0;
  const ageScore = scoreLinear(s.ageDays, 365, W_AGE);

  const total = Math.round(balScore + txScore + codeScore + ageScore);
  return { total, details: s, weights: { W_BAL, W_TXS, W_CODE, W_AGE } };
}
