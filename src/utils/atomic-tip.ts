import { sendDeso, transferDeSoToken, identity, api } from "deso-protocol";
import {
  CHATON_DONATION_PUBLIC_KEY,
  USDC_CREATOR_PUBLIC_KEY,
} from "./constants";
import { toHexUint256 } from "./usdc-balance";

/**
 * Send a DESO tip atomically: recipient receives recipientNanos,
 * ChatOn receives feeNanos, bundled in a single atomic transaction.
 */
export async function sendAtomicDesoTip(
  senderPk: string,
  recipientPk: string,
  recipientNanos: number,
  feeNanos: number
): Promise<{ TxnHashHex: string; TransactionIDBase58Check: string }> {
  // 1. Construct both transfers without broadcasting
  const { constructedTransactionResponse: tipTx } = await sendDeso(
    {
      SenderPublicKeyBase58Check: senderPk,
      RecipientPublicKeyOrUsername: recipientPk,
      AmountNanos: recipientNanos,
    },
    { broadcast: false, checkPermissions: false }
  );

  const { constructedTransactionResponse: feeTx } = await sendDeso(
    {
      SenderPublicKeyBase58Check: senderPk,
      RecipientPublicKeyOrUsername: CHATON_DONATION_PUBLIC_KEY,
      AmountNanos: feeNanos,
    },
    { broadcast: false, checkPermissions: false }
  );

  // 2. Create atomic wrapper via DeSo node
  const atomicWrapper = await api.post("api/v0/create-atomic-txns-wrapper", {
    UnsignedTransactionHexes: [tipTx.TransactionHex, feeTx.TransactionHex],
  });

  // 3. Sign and submit atomically
  return identity.signAndSubmitAtomic(atomicWrapper);
}

/**
 * Send a USDC tip atomically: recipient receives recipientBaseUnits,
 * ChatOn receives feeBaseUnits, bundled in a single atomic transaction.
 */
export async function sendAtomicUsdcTip(
  senderPk: string,
  recipientPk: string,
  recipientBaseUnits: bigint,
  feeBaseUnits: bigint
): Promise<{ TxnHashHex: string; TransactionIDBase58Check: string }> {
  // 1. Construct both DAO coin transfers without broadcasting
  const { constructedTransactionResponse: tipTx } = await transferDeSoToken(
    {
      SenderPublicKeyBase58Check: senderPk,
      ProfilePublicKeyBase58CheckOrUsername: USDC_CREATOR_PUBLIC_KEY,
      ReceiverPublicKeyBase58CheckOrUsername: recipientPk,
      DAOCoinToTransferNanos: toHexUint256(recipientBaseUnits),
    },
    { broadcast: false, checkPermissions: false }
  );

  const { constructedTransactionResponse: feeTx } = await transferDeSoToken(
    {
      SenderPublicKeyBase58Check: senderPk,
      ProfilePublicKeyBase58CheckOrUsername: USDC_CREATOR_PUBLIC_KEY,
      ReceiverPublicKeyBase58CheckOrUsername: CHATON_DONATION_PUBLIC_KEY,
      DAOCoinToTransferNanos: toHexUint256(feeBaseUnits),
    },
    { broadcast: false, checkPermissions: false }
  );

  // 2. Create atomic wrapper via DeSo node
  const atomicWrapper = await api.post("api/v0/create-atomic-txns-wrapper", {
    UnsignedTransactionHexes: [tipTx.TransactionHex, feeTx.TransactionHex],
  });

  // 3. Sign and submit atomically
  return identity.signAndSubmitAtomic(atomicWrapper);
}
