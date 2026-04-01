import {
  DeSoNetwork,
  TransactionSpendingLimitResponseOptions,
} from "deso-protocol";

export const ASSOCIATION_TYPE_APPROVED = "chaton:chat-approved";
export const ASSOCIATION_TYPE_BLOCKED = "chaton:chat-blocked";
export const ASSOCIATION_VALUE_APPROVED = "approved";
export const ASSOCIATION_VALUE_BLOCKED = "blocked";

// Generic group archive association — any DeSo chat app can query for this type
// to determine which groups a user has left/archived.
// TargetUser = group owner's public key, Value = access group key name.
export const ASSOCIATION_TYPE_GROUP_ARCHIVED = "chat:group-archived";

// DM archive — hides a DM conversation from the main chat list.
// TargetUser = the other user's public key, Value = "archived".
export const ASSOCIATION_TYPE_CHAT_ARCHIVED = "chaton:chat-archived";
export const ASSOCIATION_VALUE_ARCHIVED = "archived";

// Dismiss — hides a chat request without blocking.
// TargetUser = the sender's public key, Value = "dismissed".
export const ASSOCIATION_TYPE_DISMISSED = "chaton:chat-dismissed";
export const ASSOCIATION_VALUE_DISMISSED = "dismissed";

// Join request — a user requests to join a group chat via an invite link.
// TargetUser = group owner's public key, Value = access group key name.
export const ASSOCIATION_TYPE_GROUP_JOIN_REQUEST = "chaton:group-join-request";

// Invite code registry — maps a short alphanumeric code to a group chat.
// Transactor = group owner, Target = CHATON_REGISTRY_PUBLIC_KEY,
// Value = short code, ExtraData["group:keyName"] = access group key name.
export const ASSOCIATION_TYPE_GROUP_INVITE_CODE = "chaton:group-invite-code";
export const INVITE_CODE_LENGTH = 8;

// Privacy mode: self-association (target = self) storing the user's encryption preference.
// Value is "full" (encrypt all metadata) or "standard" (encrypt only reactions).
export const ASSOCIATION_TYPE_PRIVACY_MODE = "chaton:privacy-mode";
export const PRIVACY_MODE_FULL = "full";
export const PRIVACY_MODE_STANDARD = "standard";

export const getTransactionSpendingLimits = (
  publicKey: string
): TransactionSpendingLimitResponseOptions => {
  return {
    GlobalDESOLimit: 5 * 1e9,
    TransactionCountLimitMap: {
      AUTHORIZE_DERIVED_KEY: 1,
      NEW_MESSAGE: UNLIMITED,
      ACCESS_GROUP: UNLIMITED,
      ACCESS_GROUP_MEMBERS: UNLIMITED,
      UPDATE_PROFILE: 5,
      FOLLOW: UNLIMITED,
      CREATE_USER_ASSOCIATION: UNLIMITED,
      DELETE_USER_ASSOCIATION: UNLIMITED,
      BASIC_TRANSFER: UNLIMITED,
    },
    AccessGroupLimitMap: [
      {
        AccessGroupOwnerPublicKeyBase58Check: publicKey,
        ScopeType: "Any",
        AccessGroupKeyName: "",
        OperationType: "Any",
        OpCount: UNLIMITED,
      },
    ],
    AccessGroupMemberLimitMap: [
      {
        AccessGroupOwnerPublicKeyBase58Check: publicKey,
        ScopeType: "Any",
        AccessGroupKeyName: "",
        OperationType: "Any",
        OpCount: UNLIMITED,
      },
    ],
    // Wildcard: allows create/delete of ANY User association type.
    // The SDK's hasPermissions check matches AssociationType: "" as a wildcard
    // for all specific types. This future-proofs us — no need to update this
    // list when adding new association types.
    AssociationLimitMap: [
      {
        AssociationClass: "User" as const,
        AssociationType: "",
        AppScopeType: "Any" as const,
        AppPublicKeyBase58Check: "",
        AssociationOperation: "Any" as const,
        OpCount: UNLIMITED,
      },
    ],
  };
};
export const DEFAULT_KEY_MESSAGING_GROUP_NAME: Readonly<string> = "default-key";
export const AUTO_FOLLOW_USERNAMES: Readonly<string[]> = [
  "GetChatOn",
  "nathanwells",
];
export const IS_MAINNET: Readonly<boolean> =
  import.meta.env.VITE_IS_TESTNET !== "true";
export const USER_TO_SEND_MESSAGE_TO: Readonly<string> = IS_MAINNET
  ? "BC1YLgUCRPPtWmCwvigZay2Dip6ce1UHd2TqniZci8qgauCtUo8mQDW"
  : "tBCKW665XZnvVZcCfcEmyeecSZGKAdaxwV2SH9UFab6PpSRikg4EJ2";
export const DESO_NETWORK: Readonly<DeSoNetwork> = IS_MAINNET
  ? DeSoNetwork.mainnet
  : DeSoNetwork.testnet;
export const PUBLIC_KEY_LENGTH: Readonly<number> = IS_MAINNET ? 55 : 54;
export const PUBLIC_KEY_PREFIX: Readonly<string> = IS_MAINNET ? "BC" : "tBC";
export const MESSAGES_ONE_REQUEST_LIMIT = 25;
export const MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN = 4;
export const MAX_MEMBERS_TO_REQUEST_IN_GROUP = 50;
export const MOBILE_WIDTH_BREAKPOINT = 768;
export const REFRESH_MESSAGES_INTERVAL_MS = 5000;
export const REFRESH_MESSAGES_MOBILE_INTERVAL_MS = 20000;
export const BASE_TITLE = "DeSo Chat Protocol";
export const TITLE_DIVIDER = " · ";
export const CHATON_DONATION_PUBLIC_KEY: Readonly<string> =
  "BC1YLibU7KwQRTnWJ3nDyVzitNFdyDa28LjZDEnH5Y6xP9oHa59J5xK";
const UNLIMITED = "UNLIMITED";
