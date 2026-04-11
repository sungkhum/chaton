/**
 * Atomic paid DM: bundles a BASIC_TRANSFER (payment) + NEW_MESSAGE (DM) in a
 * single atomic transaction. The message cannot exist on-chain without the
 * payment, and vice versa.
 *
 * Reuses the tip fee infrastructure for payment splitting.
 */

import { sendDeso, sendDMMessage, identity, api } from "deso-protocol";
import { CHATON_DONATION_PUBLIC_KEY } from "./constants";
import { splitDesoTip } from "./tip-fees";
import { fetchExchangeRate, usdToNanos } from "./exchange-rate";
import type { TipCurrency } from "./extra-data";
import {
  MSG_PAID_DM,
  MSG_PAYMENT_AMOUNT_USD_CENTS,
  MSG_PAID_CURRENCY,
} from "./extra-data";

/**
 * Send a paid DM atomically: payment(s) + message bundled in a single
 * atomic transaction.
 *
 * @param senderPk Sender's public key
 * @param recipientPk Recipient's public key
 * @param priceUsdCents Price in USD cents
 * @param currency Payment currency ("DESO" for now)
 * @param messageRequestBody Pre-encrypted message request body from prepareEncryptedDMMessage
 * @returns The atomic transaction hash
 */
export async function sendAtomicPaidMessage(
  senderPk: string,
  recipientPk: string,
  priceUsdCents: number,
  currency: TipCurrency,
  messageRequestBody: Record<string, unknown>
): Promise<{ TxnHashHex: string }> {
  if (currency !== "DESO") {
    throw new Error("Only DESO payments are supported for paid DMs currently");
  }
  if (!Number.isFinite(priceUsdCents) || priceUsdCents <= 0) {
    throw new Error("Invalid payment amount");
  }

  // 1. Convert USD cents to nanos
  const exchangeRate = await fetchExchangeRate();
  const totalNanos = usdToNanos(priceUsdCents / 100, exchangeRate);
  if (totalNanos <= 0) {
    throw new Error("Payment amount too small");
  }

  // 2. Split into recipient + platform fee (reuses tip fee logic)
  const { recipientNanos, feeNanos } = splitDesoTip(
    totalNanos,
    priceUsdCents / 100
  );

  // 3. Construct payment transaction(s) without broadcasting
  const unsignedHexes: string[] = [];

  const { constructedTransactionResponse: payTx } = await sendDeso(
    {
      SenderPublicKeyBase58Check: senderPk,
      RecipientPublicKeyOrUsername: recipientPk,
      AmountNanos: recipientNanos,
    },
    { broadcast: false, checkPermissions: false }
  );
  unsignedHexes.push(payTx.TransactionHex);

  // Platform fee (only if above threshold)
  if (feeNanos > 0) {
    const { constructedTransactionResponse: feeTx } = await sendDeso(
      {
        SenderPublicKeyBase58Check: senderPk,
        RecipientPublicKeyOrUsername: CHATON_DONATION_PUBLIC_KEY,
        AmountNanos: feeNanos,
      },
      { broadcast: false, checkPermissions: false }
    );
    unsignedHexes.push(feeTx.TransactionHex);
  }

  // 4. Add paid DM metadata to the message ExtraData
  const existingExtraData =
    (messageRequestBody.ExtraData as Record<string, string>) || {};
  const enhancedRequestBody = {
    ...messageRequestBody,
    ExtraData: {
      ...existingExtraData,
      [MSG_PAID_DM]: "true",
      [MSG_PAYMENT_AMOUNT_USD_CENTS]: String(priceUsdCents),
      [MSG_PAID_CURRENCY]: currency,
    },
  };

  // 5. Construct message transaction without broadcasting
  const { constructedTransactionResponse: msgTx } = await sendDMMessage(
    enhancedRequestBody as any,
    { broadcast: false, checkPermissions: false }
  );
  unsignedHexes.push(msgTx.TransactionHex);

  // 6. Bundle all transactions atomically
  const atomicWrapper = await api.post("api/v0/create-atomic-txns-wrapper", {
    UnsignedTransactionHexes: unsignedHexes,
  });

  // 7. Sign and submit atomically (each inner tx signed individually)
  const result = await identity.signAndSubmitAtomic(atomicWrapper);

  return { TxnHashHex: result.TxnHashHex };
}
