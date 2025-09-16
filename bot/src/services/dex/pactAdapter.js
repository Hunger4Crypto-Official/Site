// Optional Pact adapter (disabled by default). Treat errors as zero.
import fetch from 'node-fetch';

const BASE = (process.env.PACT_API_BASE || '').replace(/\/+$/,'');

async function getUserLpUsd(_address, _memoAsaId = 885835936) {
  if (!BASE) return 0;
  try {
    // TODO: Implement when Pact endpoint finalized
    return 0;
  } catch {
    return 0;
  }
}

export const pactAdapter = {
  name: 'pact',
  getUserLpUsd
};
