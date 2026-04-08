import {
  ChatType,
  DecryptedMessageEntryResponse,
  SubmitTransactionResponse,
} from "deso-protocol";

/** Sentinel value for messages not yet decrypted — UI shows shimmer instead of text */
export const UNDECRYPTED_PLACEHOLDER = "\x00__UNDECRYPTED__";

export interface Conversation {
  firstMessagePublicKey: string;
  messages: DecryptedMessageEntryResponse[];
  ChatType: ChatType;
}

export interface ConversationMap {
  [k: string]: Conversation;
}

/**
 * Safely update a single conversation in a ConversationMap.
 * Returns `prev` unchanged if the key doesn't exist.
 */
export function updateConv(
  prev: ConversationMap,
  key: string,
  updater: (conv: Conversation) => Conversation
): ConversationMap {
  const conv = prev[key];
  if (!conv) return prev;
  return { ...prev, [key]: updater(conv) };
}

export interface TransactionConstructionResponse {
  TransactionHex: string;
}

export interface ConstructAndSubmitResponse {
  TransactionConstructionResponse: TransactionConstructionResponse;
  SubmitTransactionResponse: SubmitTransactionResponse;
}
