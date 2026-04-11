import type { ProfileEntryResponse } from "deso-protocol";

export interface SpamFilterConfig {
  enabled: boolean;
  /** Minimum DESO balance in nanos (0 = disabled). */
  minBalanceNanos: number;
  /** Require the sender to have a DeSo profile. */
  requireProfile: boolean;
}

export const DEFAULT_SPAM_FILTER: SpamFilterConfig = {
  enabled: false,
  minBalanceNanos: 0,
  requireProfile: false,
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

  return true;
}
