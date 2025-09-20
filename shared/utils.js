// Shared utility functions for H4C applications

/**
 * Clamp a number between min and max values.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear scoring helper used by badge/reputation calculations.
 */
export function scoreLinear(value, maxValue, weight) {
  if (typeof value !== 'number' || typeof maxValue !== 'number' || maxValue <= 0) return 0;
  const ratio = clamp(value / maxValue, 0, 1);
  return ratio * (typeof weight === 'number' ? weight : 1);
}

/**
 * Logarithmic scoring helper for diminishing returns curves.
 */
export function scoreLog(value, k, weight) {
  if (typeof value !== 'number' || value <= 0 || typeof k !== 'number' || k <= 0) return 0;
  const denominator = Math.log(1 + 100 * k);
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  const numerator = Math.log(1 + value / k);
  return clamp(numerator / denominator, 0, 1) * (typeof weight === 'number' ? weight : 1);
}

/**
 * Sleep helper that resolves after the specified milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms || 0)));
}

/**
 * Simple retry helper with exponential backoff.
 * @param {Function} fn operation that returns a promise
 * @param {number} attempts maximum attempts (default 3)
 * @param {number} baseDelay initial delay in ms (default 250)
 */
export async function retry(fn, attempts = 3, baseDelay = 250) {
  if (typeof fn !== 'function') throw new TypeError('retry requires a function');
  const maxAttempts = Math.max(1, attempts);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Redact sensitive parts of an address for logging.
 */
export function redactAddress(address) {
  if (!address || typeof address !== 'string') return address;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isValidAlgorandAddress(address) {
  return typeof address === 'string' && /^[A-Z2-7]{58}$/.test(address);
}

export function isValidEthereumAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidSolanaAddress(address) {
  return typeof address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidIpAddress(ip) {
  if (typeof ip !== 'string') return false;
  const v4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const v6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return v4.test(ip) || v6.test(ip);
}

export function maskIp(ip) {
  if (!isValidIpAddress(ip)) return 'unknown';
  if (ip.includes(':')) {
    // IPv6 – keep first two hextets
    const parts = ip.split(':');
    return `${parts.slice(0, 2).join(':')}::`; // simplified mask
  }
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.x.x`;
}

export function coalesce(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}
