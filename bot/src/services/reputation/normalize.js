export function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

export function scoreLinear(value, maxValue, weight) {
  if (maxValue <= 0) return 0;
  const s = clamp(value / maxValue, 0, 1);
  return s * weight;
}

export function scoreLog(value, k, weight) {
  const denom = Math.log(1 + 100 * k);
  const s = denom > 0 ? Math.log(1 + value / k) / denom : 0;
  return clamp(s, 0, 1) * weight;
}
