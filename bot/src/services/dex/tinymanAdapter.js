import fetch from 'node-fetch';
const TINYMAN_API = process.env.TINYMAN_API || 'https://mainnet.analytics.tinyman.org/api/v1';

async function getUserLpUsd(address, memoAsaId = 885835936) {
  const url = `${TINYMAN_API}/accounts/${address}/positions/`;
  const res = await fetch(url, { timeout: 10000 }).catch(() => null);
  if (!res || !res.ok) return 0;
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) return 0;
  let total = 0;
  for (const p of data) {
    const a = p?.asset_1_id;
    const b = p?.asset_2_id;
    const usd = Number(p?.position_value_usd || 0);
    if (!isFinite(usd)) continue;
    if (a === memoAsaId || b === memoAsaId) total += usd;
  }
  return total;
}

export const tinymanAdapter = {
  name: 'tinyman',
  getUserLpUsd
};
