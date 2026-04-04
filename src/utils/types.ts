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

export interface TransactionConstructionResponse {
  TransactionHex: string;
}

export interface ConstructAndSubmitResponse {
  TransactionConstructionResponse: TransactionConstructionResponse;
  SubmitTransactionResponse: SubmitTransactionResponse;
}
