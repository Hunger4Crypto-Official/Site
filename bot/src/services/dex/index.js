import { tinymanAdapter } from './tinymanAdapter.js';
import { pactAdapter } from './pactAdapter.js';

export function getEnabledDexes() {
  const dexes = [];
  if (String(process.env.ENABLE_TINYMAN || 'true').toLowerCase() === 'true') {
    dexes.push(tinymanAdapter);
  }
  if (String(process.env.ENABLE_PACT || 'false').toLowerCase() === 'true' && process.env.PACT_API_BASE) {
    dexes.push(pactAdapter);
  }
  return dexes;
}
