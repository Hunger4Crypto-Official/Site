// Pact DEX adapter - now with actual implementation
import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';
import { metricsRecordIndexer } from '../../middleware/metrics.js';

const BASE = (process.env.PACT_API_BASE || '').replace(/\/+$/,'');
const TIMEOUT = 10000;

async function pactApiCall(endpoint, params = {}) {
  if (!BASE) {
    logger.debug('Pact API disabled - no BASE URL configured');
    return null;
  }

  const url = new URL(`${BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  });

  try {
    logger.debug({ url: url.toString() }, 'Pact API call');
    const response = await fetch(url.toString(), {
      timeout: TIMEOUT,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'H4C-Bot/1.0'
      }
    });

    metricsRecordIndexer(response.ok, response.status);

    if (!response.ok) {
      logger.warn({ 
        status: response.status, 
        statusText: response.statusText,
        url: url.toString() 
      }, 'Pact API error response');
      return null;
    }

    const data = await response.json();
    logger.debug({ endpoint, dataKeys: Object.keys(data) }, 'Pact API success');
    return data;
  } catch (error) {
    metricsRecordIndexer(false, 0);
    logger.warn({ 
      error: String(error), 
      endpoint,
      baseUrl: BASE 
    }, 'Pact API call failed');
    return null;
  }
}

async function getUserLpUsd(address, memoAsaId = 885835936) {
  // If Pact is disabled, return 0
  if (!BASE || String(process.env.ENABLE_PACT || 'false').toLowerCase() !== 'true') {
    return 0;
  }

  try {
    // Call Pact API to get user's LP positions
    // This is a generic implementation - adjust endpoints based on actual Pact API
    const positions = await pactApiCall('/liquidity/positions', {
      address: address,
      asset_id: memoAsaId
    });

    if (!positions || !Array.isArray(positions.data)) {
      return 0;
    }

    let totalUsd = 0;
    for (const position of positions.data) {
      // Sum up USD values from all positions involving the memo asset
      const positionValue = Number(position.value_usd || 0);
      if (Number.isFinite(positionValue) && positionValue > 0) {
        // Check if this position involves the memo asset
        const asset1 = Number(position.asset_1_id || 0);
        const asset2 = Number(position.asset_2_id || 0);
        
        if (asset1 === memoAsaId || asset2 === memoAsaId) {
          totalUsd += positionValue;
        }
      }
    }

    logger.debug({ 
      address: address.slice(0, 8) + '...', 
      memoAsaId, 
      totalUsd,
      positionCount: positions.data.length 
    }, 'Pact LP USD calculated');

    return totalUsd;

  } catch (error) {
    logger.warn({ 
      error: String(error), 
      address: address.slice(0, 8) + '...',
      memoAsaId 
    }, 'Failed to get Pact LP USD');
    return 0;
  }
}

// Alternative implementation if Pact uses different API structure
async function getUserLpUsdAlternative(address, memoAsaId = 885835936) {
  if (!BASE || String(process.env.ENABLE_PACT || 'false').toLowerCase() !== 'true') {
    return 0;
  }

  try {
    // Try alternative API structure
    const accountData = await pactApiCall(`/accounts/${address}/liquidity`);
    
    if (!accountData || !accountData.pools) {
      return 0;
    }

    let totalUsd = 0;
    for (const pool of accountData.pools) {
      if (pool.assets && pool.assets.includes(memoAsaId)) {
        const poolValue = Number(pool.usd_value || 0);
        if (Number.isFinite(poolValue)) {
          totalUsd += poolValue;
        }
      }
    }

    return totalUsd;

  } catch (error) {
    logger.warn({ error: String(error) }, 'Failed to get Pact LP USD (alternative)');
    return 0;
  }
}

// Health check function
async function healthCheck() {
  if (!BASE) {
    return { healthy: false, reason: 'Pact API disabled' };
  }

  try {
    const response = await pactApiCall('/health');
    return { 
      healthy: response !== null, 
      response: response,
      baseUrl: BASE 
    };
  } catch (error) {
    return { 
      healthy: false, 
      reason: String(error),
      baseUrl: BASE 
    };
  }
}

export const pactAdapter = {
  name: 'pact',
  getUserLpUsd,
  getUserLpUsdAlternative, // Export alternative for testing
  healthCheck,
  
  // Expose internal functions for testing
  _internal: {
    pactApiCall
  }
};

// Export individual functions for direct testing
export { getUserLpUsd, healthCheck };
