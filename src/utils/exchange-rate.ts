import { getExchangeRates } from "deso-protocol";

let cachedRate: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Fetch the current USD cents per DESO exchange rate.
 * Cached for 60 seconds to avoid hammering the API.
 */
export async function fetchExchangeRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRate;
  }
  const resp = await getExchangeRates();
  cachedRate = resp.USDCentsPerDeSoExchangeRate;
  cacheTimestamp = now;
  return cachedRate;
}

/** Convert a USD amount to DESO nanos. */
export function usdToNanos(
  usdAmount: number,
  usdCentsPerDeso: number
): number {
  if (usdCentsPerDeso <= 0) return 0;
  const desoAmount = (usdAmount * 100) / usdCentsPerDeso;
  return Math.round(desoAmount * 1e9);
}

/** Convert DESO nanos to a USD amount. */
export function nanosToUsd(
  nanos: number,
  usdCentsPerDeso: number
): number {
  const desoAmount = nanos / 1e9;
  return (desoAmount * usdCentsPerDeso) / 100;
}

/** Format a USD amount for display (e.g., "$1.00", "$0.01"). */
export function formatUsd(usdAmount: number): string {
  return `$${usdAmount.toFixed(2)}`;
}
