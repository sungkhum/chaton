import type { ProfileEntryResponse } from "deso-protocol";

export interface SpamFilterConfig {
  enabled: boolean;
  /** Minimum DESO balance in nanos (0 = disabled). */
  minBalanceNanos: number;
  /** Minimum creator coin price in DeSo nanos (0 = disabled). */
  minCoinPriceNanos: number;
  /** Require the sender to have a DeSo profile. */
  requireProfile: boolean;
  /** Minimum number of creator coin holders (0 = disabled). */
  minCoinHolders: number;
}

export const DEFAULT_SPAM_FILTER: SpamFilterConfig = {
  enabled: false,
  minBalanceNanos: 0,
  minCoinPriceNanos: 0,
  requireProfile: false,
  minCoinHolders: 0,
};

/**
 * Check whether a sender's profile passes the user's spam filter thresholds.
 * Returns true if the sender passes (should be promoted to chat), false if
 * they fail (should stay in requests).
 *
 * If the filter is disabled or the profile is null (can't evaluate), returns null
 * to indicate the filter doesn't apply.
 */
export function passesSenderFilter(
  filter: SpamFilterConfig,
  profile: ProfileEntryResponse | null | undefined,
  senderBalanceNanos?: number
): boolean | null {
  if (!filter.enabled) return null;

  if (filter.requireProfile && !profile) return false;

  if (filter.minBalanceNanos > 0) {
    const balance = senderBalanceNanos ?? profile?.DESOBalanceNanos ?? 0;
    if (balance < filter.minBalanceNanos) return false;
  }

  if (filter.minCoinPriceNanos > 0) {
    const coinPrice = profile?.CoinPriceDeSoNanos ?? 0;
    if (coinPrice < filter.minCoinPriceNanos) return false;
  }

  if (filter.minCoinHolders > 0) {
    const holders = profile?.CoinEntry?.NumberOfHolders ?? 0;
    if (holders < filter.minCoinHolders) return false;
  }

  return true;
}
