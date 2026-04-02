import { getHodlersForUser } from "deso-protocol";
import { USDC_CREATOR_PUBLIC_KEY } from "./constants";

let cachedBalance: { publicKey: string; value: bigint; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetch the user's USDC DAO coin balance.
 * Cached for 30 seconds per user.
 */
export async function fetchUsdcBalance(userPublicKey: string): Promise<bigint> {
  const now = Date.now();
  if (
    cachedBalance &&
    cachedBalance.publicKey === userPublicKey &&
    now - cachedBalance.timestamp < CACHE_TTL_MS
  ) {
    return cachedBalance.value;
  }

  const resp = await getHodlersForUser({
    PublicKeyBase58Check: userPublicKey,
    IsDAOCoin: true,
    FetchHodlings: true,
  });

  const entry = (resp as any).Hodlers?.find(
    (h: any) => h.CreatorPublicKeyBase58Check === USDC_CREATOR_PUBLIC_KEY
  );

  const hexStr = entry?.BalanceNanosUint256;
  const balance = hexStr ? BigInt("0x" + hexStr) : 0n;

  cachedBalance = { publicKey: userPublicKey, value: balance, timestamp: now };
  return balance;
}

/** Invalidate the USDC balance cache (e.g., after a tip). */
export function invalidateUsdcBalanceCache(): void {
  cachedBalance = null;
}

/** Convert USDC base units (1e18 per USDC) to a USD number. */
export function usdcBaseUnitsToUsd(baseUnits: bigint): number {
  // Use string division to avoid floating-point loss for large amounts
  // Keep 6 decimal places of precision
  const scaled = baseUnits * 1_000_000n / (10n ** 18n);
  return Number(scaled) / 1_000_000;
}

/** Convert a USD amount to USDC base units (1e18 per USDC). */
export function usdToUsdcBaseUnits(usdAmount: number): bigint {
  // Multiply by 1e6 first to preserve cents precision, then scale to 1e18
  const microUsd = BigInt(Math.round(usdAmount * 1_000_000));
  return microUsd * (10n ** 12n); // 1e6 * 1e12 = 1e18
}

/** Convert a BigInt to the hex uint256 string required by TransferDAOCoinRequest. */
export function toHexUint256(value: bigint): string {
  return "0x" + value.toString(16);
}
