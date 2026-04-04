import { TIP_FEE_RATE, TIP_FEE_THRESHOLD_USD } from "./constants";

/** Returns true if the given USD amount qualifies for a platform fee. */
export function hasTipFee(amountUsd: number): boolean {
  return amountUsd >= TIP_FEE_THRESHOLD_USD;
}

/** Calculate the platform fee in USD for a given tip amount. */
export function tipFeeUsd(amountUsd: number): number {
  if (!hasTipFee(amountUsd)) return 0;
  return amountUsd * TIP_FEE_RATE;
}

/** Calculate the recipient amount in USD after fee deduction. */
export function tipRecipientUsd(amountUsd: number): number {
  return amountUsd - tipFeeUsd(amountUsd);
}

/**
 * For DESO tips: split total nanos into recipient + fee.
 * Fee is computed as a fraction of total; recipient gets the remainder.
 * This guarantees recipientNanos + feeNanos === totalNanos exactly.
 */
export function splitDesoTip(
  totalAmountNanos: number,
  amountUsd: number
): { recipientNanos: number; feeNanos: number } {
  if (!hasTipFee(amountUsd)) {
    return { recipientNanos: totalAmountNanos, feeNanos: 0 };
  }
  const feeNanos = Math.round(totalAmountNanos * TIP_FEE_RATE);
  const recipientNanos = totalAmountNanos - feeNanos;
  return { recipientNanos, feeNanos };
}

/**
 * For USDC tips: split total base units into recipient + fee.
 * Uses integer division — fee is rounded down, recipient gets the remainder.
 * Guarantees recipientBaseUnits + feeBaseUnits === totalBaseUnits exactly.
 */
export function splitUsdcTip(
  totalBaseUnits: bigint,
  amountUsd: number
): { recipientBaseUnits: bigint; feeBaseUnits: bigint } {
  if (!hasTipFee(amountUsd)) {
    return { recipientBaseUnits: totalBaseUnits, feeBaseUnits: 0n };
  }
  const feeBaseUnits = (totalBaseUnits * 10n) / 100n;
  const recipientBaseUnits = totalBaseUnits - feeBaseUnits;
  return { recipientBaseUnits, feeBaseUnits };
}
