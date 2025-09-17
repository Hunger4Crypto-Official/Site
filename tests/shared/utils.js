// Shared utility functions for H4C applications

/**
 * Clamp a number between min and max values
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear scoring function
 */
export function scoreLinear(value, maxValue, weight) {
  if (maxValue <= 0) return 0;
  const score = clamp(value / maxValue, 0, 1);
  return score * weight;
}

/**
 * Logarithmic scoring function for diminishing returns
 */
export function scoreLog(value, k, weight) {
  const denominator = Math.log(1 + 100 * k);
  const score = denominator > 0 ? Math.log(1 + value / k) / denominator : 0;
  return clamp(score, 0, 1) * weight;
}

/**
 * Redact sensitive parts of an address for logging
 */
export function redactAddress(address) {
  if (!address || typeof address !== 'string') return address;
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Validate Algorand address format
 */
export function isValidAlgorandAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Basic Algorand address validation (58 chars, base32)
  return /^[A-Z2-7]{58}$/.test(address);
}

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Basic Ethereum address validation (42 chars with 0x prefix)
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Basic Solana address validation (32-44 chars, base58)
  return /^[1-9A-HJ-NP-Za-km-z]{32
