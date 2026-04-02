import {
  AccessGroupEntryResponse,
  ChatType,
  checkPartyAccessGroups,
  createUserAssociation,
  DecryptedMessageEntryResponse,
  deleteUserAssociation,
  getAllAccessGroups,
  getAllMessageThreads,
  getBulkAccessGroups,
  getFollowersForUser,
  getPaginatedAccessGroupMembers,
  getUserAssociations,
  identity,
  NewMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  sendDMMessage,
  sendGroupChatMessage,
  updateDMMessage,
  updateGroupChatMessage,
  waitForTransactionFound,
} from "deso-protocol";
import { toast } from "sonner";
import { withAuth } from "../utils/with-auth";
import {
  ASSOCIATION_TYPE_APPROVED,
  ASSOCIATION_TYPE_BLOCKED,
  ASSOCIATION_TYPE_CHAT_ARCHIVED,
  ASSOCIATION_TYPE_DISMISSED,
  ASSOCIATION_TYPE_GROUP_ARCHIVED,
  ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
  ASSOCIATION_TYPE_PRIVACY_MODE,
  ASSOCIATION_VALUE_APPROVED,
  ASSOCIATION_VALUE_ARCHIVED,
  ASSOCIATION_VALUE_BLOCKED,
  ASSOCIATION_VALUE_DISMISSED,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  PRIVACY_MODE_FULL,
  PRIVACY_MODE_STANDARD,
  USER_TO_SEND_MESSAGE_TO,
} from "../utils/constants";
import {
  FULL_ENCRYPTED_KEYS,
  MSG_ENCRYPTED,
  type PrivacyMode,
  type SystemAction,
  type MentionEntry,
  getEncryptedExtraDataKeys,
  buildExtraData,
} from "../utils/extra-data";
import { Conversation, ConversationMap } from "../utils/types";
import { useStore } from "../store";
import { bytesToHex } from "@noble/hashes/utils";

export const getConversationsNewMap = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const {
    decrypted,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  } = await getConversationNew(userPublicKeyBase58Check, allAccessGroups);
  const conversations: ConversationMap = {};
  decrypted.forEach((dmr) => {
    const otherInfo =
      dmr.ChatType === ChatType.DM
        ? dmr.IsSender
          ? dmr.RecipientInfo
          : dmr.SenderInfo
        : dmr.RecipientInfo;
    const key =
      otherInfo.OwnerPublicKeyBase58Check +
      (otherInfo.AccessGroupKeyName
        ? otherInfo.AccessGroupKeyName
        : DEFAULT_KEY_MESSAGING_GROUP_NAME);
    const currentConversation = conversations[key];
    if (currentConversation) {
      currentConversation.messages.push(dmr);
      currentConversation.messages.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
      return;
    }
    conversations[key] = {
      firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
      messages: [dmr],
      ChatType: dmr.ChatType,
    };
  });
  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
};

export const getConversationNew = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const messages = await getAllMessageThreads({
    UserPublicKeyBase58Check: userPublicKeyBase58Check,
  });
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      messages.MessageThreads,
      allAccessGroups
    );
  return {
    decrypted,
    publicKeyToProfileEntryResponseMap:
      messages.PublicKeyToProfileEntryResponse,
    updatedAllAccessGroups,
  };
};

export const getConversations = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  try {
    let {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    } = await getConversationsNewMap(userPublicKeyBase58Check, allAccessGroups);

    if (Object.keys(conversations).length === 0) {
      const txnHashHex = await encryptAndSendNewMessage(
        "Hi. This is my first test message!",
        userPublicKeyBase58Check,
        USER_TO_SEND_MESSAGE_TO
      );
      await waitForTransactionFound(txnHashHex);
      const getConversationsNewMapResponse = await getConversationsNewMap(
        userPublicKeyBase58Check,
        allAccessGroups
      );
      conversations = getConversationsNewMapResponse.conversations;
      publicKeyToProfileEntryResponseMap =
        getConversationsNewMapResponse.publicKeyToProfileEntryResponseMap;
      updatedAllAccessGroups =
        getConversationsNewMapResponse.updatedAllAccessGroups;
    }
    return {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    };
  } catch (e: any) {
    toast.error(e.toString());
    console.error(e);
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap: {},
      updatedAllAccessGroups: [],
    };
  }
};

export const decryptAccessGroupMessagesWithRetry = async (
  publicKeyBase58Check: string,
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  let decryptedMessageEntries = await decryptAccessGroupMessages(
    messages,
    accessGroups
  );

  // Retry with fresh access groups if any message failed to decrypt.
  // "access group key not found" = group missing from local list.
  // "incorrect MAC" = stale/outdated group key (e.g. key was rotated).
  // Both are fixed by fetching the latest access groups from the blockchain.
  const hasDecryptionErrors = decryptedMessageEntries.some(
    (dmr) => dmr.error && !dmr.DecryptedMessage
  );
  if (hasDecryptionErrors) {
    const newAllAccessGroups = await getAllAccessGroups({
      PublicKeyBase58Check: publicKeyBase58Check,
    });
    accessGroups = (newAllAccessGroups.AccessGroupsOwned || []).concat(
      newAllAccessGroups.AccessGroupsMember || []
    );
    decryptedMessageEntries = await decryptAccessGroupMessages(
      messages,
      accessGroups
    );
  }

  // Fallback for "incorrect MAC" on group messages: the sender's app may
  // have recorded their base public key in SenderInfo instead of their
  // default-key messaging public key. Fetch the actual default-key and
  // retry decryption with a patched SenderInfo.
  const macErrors = decryptedMessageEntries.filter(
    (msg) =>
      msg.error?.includes("incorrect MAC") &&
      !msg.DecryptedMessage &&
      msg.ChatType === ChatType.GROUPCHAT
  );
  if (macErrors.length > 0) {
    // Collect unique sender keys that failed
    const failedSenderKeys = [
      ...new Set(macErrors.map((m) => m.SenderInfo.OwnerPublicKeyBase58Check)),
    ];

    // Fetch each sender's default-key access group to get their real messaging public key
    const senderDefaultKeyMap = new Map<string, string>();
    try {
      const { AccessGroupEntries } = await getBulkAccessGroups({
        GroupOwnerAndGroupKeyNamePairs: failedSenderKeys.map((pk) => ({
          GroupOwnerPublicKeyBase58Check: pk,
          GroupKeyName: "default-key",
        })),
      });
      for (const entry of AccessGroupEntries || []) {
        senderDefaultKeyMap.set(
          entry.AccessGroupOwnerPublicKeyBase58Check,
          entry.AccessGroupPublicKeyBase58Check
        );
      }
    } catch {
      // Non-fatal — fall through with whatever we have
    }

    if (senderDefaultKeyMap.size > 0) {
      // Build patched messages: swap the sender's stated public key with
      // their actual default-key public key, then re-decrypt.
      const indicesToRetry: number[] = [];
      const patchedMessages: NewMessageEntryResponse[] = [];
      for (let i = 0; i < decryptedMessageEntries.length; i++) {
        const msg = decryptedMessageEntries[i];
        if (
          !msg.error?.includes("incorrect MAC") ||
          msg.DecryptedMessage ||
          msg.ChatType !== ChatType.GROUPCHAT
        )
          continue;

        const realKey = senderDefaultKeyMap.get(
          msg.SenderInfo.OwnerPublicKeyBase58Check
        );
        // Skip if we don't have the default key, or it's the same as what was tried
        if (!realKey || realKey === msg.SenderInfo.AccessGroupPublicKeyBase58Check)
          continue;

        indicesToRetry.push(i);
        patchedMessages.push({
          ...messages[i],
          SenderInfo: {
            ...messages[i].SenderInfo,
            AccessGroupPublicKeyBase58Check: realKey,
            AccessGroupKeyName: "default-key",
          },
        } as NewMessageEntryResponse);
      }

      if (patchedMessages.length > 0) {
        const retried = await decryptAccessGroupMessages(
          patchedMessages,
          accessGroups
        );
        for (let j = 0; j < indicesToRetry.length; j++) {
          if (retried[j].DecryptedMessage) {
            decryptedMessageEntries[indicesToRetry[j]] = retried[j];
          }
        }
      }
    }
  }

  return {
    decrypted: decryptedMessageEntries,
    updatedAllAccessGroups: accessGroups,
  };
};

export const decryptAccessGroupMessages = async (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> => {
  const decrypted = await Promise.all(
    (messages || []).map((m) => identity.decryptMessage(m, accessGroups))
  );

  // Decrypt any encrypted ExtraData values (e.g. msg:emoji, msg:action)
  return Promise.all(
    decrypted.map((msg) => decryptExtraDataFields(msg, accessGroups))
  );
};

/** Keys from the DeSo main app (Diamond/Focus) that contain encrypted media URLs. */
const DESO_APP_ENCRYPTED_KEYS = [
  "encryptedVideoURLs",
  "encryptedImageURLs",
] as const;

/**
 * If a message has encrypted ExtraData values (flagged by msg:encrypted),
 * decrypt each one by feeding it through identity.decryptMessage as a
 * fake message. This reuses the SDK's DM-vs-group key resolution so we
 * don't need to reimplement it.
 *
 * Also handles DeSo main app format (encryptedVideoURLs, encryptedImageURLs)
 * which encrypts media URLs independently of the msg:encrypted flag.
 */
async function decryptExtraDataFields(
  msg: DecryptedMessageEntryResponse,
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse> {
  const extra = msg.MessageInfo?.ExtraData;
  if (!extra) return msg;

  const updatedExtra = { ...extra };

  // Decrypt ChatOn-format encrypted ExtraData (msg:encrypted flag)
  if (extra[MSG_ENCRYPTED] === "true") {
    for (const key of FULL_ENCRYPTED_KEYS) {
      const cipherText = updatedExtra[key];
      if (!cipherText) continue;

      try {
        const fakeMsg = {
          ...msg,
          MessageInfo: {
            ...msg.MessageInfo,
            EncryptedText: cipherText,
            ExtraData: Object.fromEntries(
              Object.entries(extra).filter(([k]) => k !== "unencrypted")
            ),
          },
        } as NewMessageEntryResponse;

        const decryptedFake = await identity.decryptMessage(fakeMsg, accessGroups);
        updatedExtra[key] = decryptedFake.DecryptedMessage;
      } catch {
        // If decryption fails (e.g. legacy plaintext value), leave as-is
      }
    }
  }

  // Decrypt DeSo main app encrypted media URLs (encryptedVideoURLs, encryptedImageURLs)
  for (const key of DESO_APP_ENCRYPTED_KEYS) {
    const cipherText = updatedExtra[key];
    if (!cipherText) continue;

    try {
      const fakeMsg = {
        ...msg,
        MessageInfo: {
          ...msg.MessageInfo,
          EncryptedText: cipherText,
          ExtraData: Object.fromEntries(
            Object.entries(extra).filter(([k]) => k !== "unencrypted")
          ),
        },
      } as NewMessageEntryResponse;

      const decryptedFake = await identity.decryptMessage(fakeMsg, accessGroups);
      updatedExtra[key] = decryptedFake.DecryptedMessage;
    } catch {
      // If decryption fails, leave as-is
    }
  }

  return {
    ...msg,
    MessageInfo: {
      ...msg.MessageInfo,
      ExtraData: updatedExtra,
    },
  };
}

export const encryptAndSendNewMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  additionalExtraData: Record<string, string> = {}
): Promise<string> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = { ...additionalExtraData };
  if (response.RecipientAccessGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check,
      messageToSend
    );

    // Always encrypt DeSo app media URLs (encryptedVideoURLs, encryptedImageURLs)
    // to match the standard DeSo format used by Diamond/Focus.
    for (const key of DESO_APP_ENCRYPTED_KEYS) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
      }
    }

    // Encrypt sensitive ExtraData values with the same recipient key.
    // Which keys are encrypted depends on the user's privacy mode.
    const keysToEncrypt = getEncryptedExtraDataKeys(
      useStore.getState().privacyMode
    );
    let hasEncrypted = false;
    for (const key of keysToEncrypt) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
        hasEncrypted = true;
      }
    }
    if (hasEncrypted) {
      ExtraData[MSG_ENCRYPTED] = "true";
    }
  } else {
    message = bytesToHex(new TextEncoder().encode(messageToSend));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  if (!message) {
    return Promise.reject("error encrypting message");
  }

  const requestBody = {
    SenderAccessGroupOwnerPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupPublicKeyBase58Check:
      response.SenderAccessGroupPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientAccessGroupOwnerPublicKeyBase58Check:
      RecipientPublicKeyBase58Check,
    RecipientAccessGroupPublicKeyBase58Check: isUnencrypted
      ? response.RecipientPublicKeyBase58Check
      : response.RecipientAccessGroupPublicKeyBase58Check,
    RecipientAccessGroupKeyName: response.RecipientAccessGroupKeyName,
    ExtraData,
    EncryptedMessageText: message,
    MinFeeRateNanosPerKB: 1000,
  };

  const isDM =
    !RecipientMessagingKeyName ||
    RecipientMessagingKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME;

  const { submittedTransactionResponse } = await withAuth(() =>
    isDM ? sendDMMessage(requestBody) : sendGroupChatMessage(requestBody)
  );

  if (!submittedTransactionResponse) {
    throw new Error("Failed to submit transaction for sending message.");
  }

  return submittedTransactionResponse.TxnHashHex;
};

/**
 * Send a system log message to a group chat (e.g. "X joined the group").
 * Best-effort — errors are logged but never thrown.
 */
export const sendSystemMessage = async (
  senderPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string,
  action: SystemAction,
  members: MentionEntry[]
): Promise<void> => {
  const names = members.map((m) => m.un || m.pk.slice(0, 8));
  const label = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  const verb = action === "member-left" ? "left" : "joined";
  const fallback = `${label} ${verb} the group`;

  try {
    await encryptAndSendNewMessage(
      fallback,
      senderPublicKey,
      groupOwnerPublicKey,
      groupKeyName,
      DEFAULT_KEY_MESSAGING_GROUP_NAME,
      buildExtraData({
        type: "system",
        systemAction: action,
        systemMembers: members,
      })
    );
  } catch (e) {
    console.error("Failed to send system message:", e);
  }
};

export const encryptAndUpdateMessage = async (
  newMessageText: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  originalTimestampNanosString: string,
  additionalExtraData: Record<string, string> = {}
): Promise<string> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = { ...additionalExtraData };
  if (response.RecipientAccessGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check,
      newMessageText
    );

    const keysToEncrypt = getEncryptedExtraDataKeys(
      useStore.getState().privacyMode
    );
    let hasEncrypted = false;
    for (const key of keysToEncrypt) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
        hasEncrypted = true;
      }
    }
    if (hasEncrypted) {
      ExtraData[MSG_ENCRYPTED] = "true";
    }
  } else {
    message = bytesToHex(new TextEncoder().encode(newMessageText));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  if (!message) {
    return Promise.reject("error encrypting message");
  }

  const requestBody = {
    SenderAccessGroupOwnerPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupPublicKeyBase58Check:
      response.SenderAccessGroupPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientAccessGroupOwnerPublicKeyBase58Check:
      RecipientPublicKeyBase58Check,
    RecipientAccessGroupPublicKeyBase58Check: isUnencrypted
      ? response.RecipientPublicKeyBase58Check
      : response.RecipientAccessGroupPublicKeyBase58Check,
    RecipientAccessGroupKeyName: response.RecipientAccessGroupKeyName,
    ExtraData,
    EncryptedMessageText: message,
    TimestampNanosString: originalTimestampNanosString,
    MinFeeRateNanosPerKB: 1000,
  };

  const isDM =
    !RecipientMessagingKeyName ||
    RecipientMessagingKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME;

  const { submittedTransactionResponse } = await withAuth(() =>
    isDM ? updateDMMessage(requestBody) : updateGroupChatMessage(requestBody)
  );

  if (!submittedTransactionResponse) {
    throw new Error("Failed to submit transaction for updating message.");
  }

  return submittedTransactionResponse.TxnHashHex;
};

// ── Chat Requests: fetch & classify ─────────────────────────────────

const FOLLOWS_PAGE_SIZE = 500;

async function fetchAllFollowsPaginated(
  publicKey: string,
  getFollowers: boolean
): Promise<Set<string>> {
  const keys = new Set<string>();
  let lastKey = "";

  while (true) {
    const res = await getFollowersForUser({
      PublicKeyBase58Check: publicKey,
      GetEntriesFollowingUsername: getFollowers,
      NumToFetch: FOLLOWS_PAGE_SIZE,
      ...(lastKey ? { LastPublicKeyBase58Check: lastKey } : {}),
    });

    const entries = Object.keys(res.PublicKeyToProfileEntry || {});
    if (entries.length === 0) break;

    for (const k of entries) keys.add(k);
    if (entries.length < FOLLOWS_PAGE_SIZE) break;
    lastKey = entries[entries.length - 1];
  }

  return keys;
}

export async function fetchMutualFollows(
  publicKey: string
): Promise<Set<string>> {
  const [iFollow, followsMe] = await Promise.all([
    fetchAllFollowsPaginated(publicKey, false),
    fetchAllFollowsPaginated(publicKey, true),
  ]);

  const mutual = new Set<string>();
  for (const key of iFollow) {
    if (followsMe.has(key)) mutual.add(key);
  }
  return mutual;
}

/** Fetch all associations of a single type. Returns Map<targetPubKey, associationId>. */
export async function fetchAssociationsByType(
  publicKey: string,
  associationType: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: associationType,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      map.set(a.TargetUserPublicKeyBase58Check, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }

  return map;
}

export async function fetchChatAssociations(
  publicKey: string
): Promise<{
  approved: Map<string, string>;
  blocked: Map<string, string>;
  archivedChats: Map<string, string>;
  dismissed: Map<string, string>;
}> {
  const [approved, blocked, archivedChats, dismissed] = await Promise.all([
    fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_APPROVED),
    fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_BLOCKED),
    fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_CHAT_ARCHIVED),
    fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_DISMISSED),
  ]);

  return { approved, blocked, archivedChats, dismissed };
}

export function classifyConversation(
  conversation: Conversation,
  conversationKey: string,
  myPublicKey: string,
  mutualFollows: Set<string>,
  approvedUsers: Set<string>,
  blockedUsers: Set<string>,
  initiatedChats: Set<string>,
  archivedGroups: Set<string>,
  archivedChats: Set<string>,
  dismissedUsers: Set<string>
): "chat" | "request" | "blocked" | "archived" | "dismissed" {
  if (conversation.ChatType === ChatType.GROUPCHAT) {
    if (archivedGroups.has(conversationKey)) return "archived";
    return "chat";
  }

  const otherKey = conversation.firstMessagePublicKey;

  if (blockedUsers.has(otherKey)) return "blocked";
  if (dismissedUsers.has(otherKey)) return "dismissed";
  if (archivedChats.has(otherKey)) return "archived";
  if (mutualFollows.has(otherKey)) return "chat";
  if (approvedUsers.has(otherKey)) return "chat";
  if (initiatedChats.has(otherKey)) return "chat";

  // If the current user sent the first message (chronologically), they initiated
  if (conversation.messages.length > 0) {
    const oldest = conversation.messages[conversation.messages.length - 1];
    if (
      oldest.IsSender ||
      oldest.SenderInfo?.OwnerPublicKeyBase58Check === myPublicKey
    ) {
      return "chat";
    }
  }

  return "request";
}

// All createUserAssociation calls use checkPermissions: false to skip the SDK's
// built-in per-transaction guardTxPermission prompt. We handle permissions ourselves
// via withAuth (which requests the full spending limits on failure) and the startup
// ensurePermissions toast. Without this, the SDK prompts individually per association type.

export async function createApprovalAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: targetPublicKey,
      AssociationType: ASSOCIATION_TYPE_APPROVED,
      AssociationValue: ASSOCIATION_VALUE_APPROVED,
    }, { checkPermissions: false })
  );
}

export async function createBlockAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: targetPublicKey,
      AssociationType: ASSOCIATION_TYPE_BLOCKED,
      AssociationValue: ASSOCIATION_VALUE_BLOCKED,
    }, { checkPermissions: false })
  );
}

// ── Group archive (leave group) ─────────────────────────────────────

export async function fetchArchivedGroups(
  publicKey: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_ARCHIVED,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      // Reconstruct conversation key: ownerPubKey + groupKeyName
      const conversationKey =
        a.TargetUserPublicKeyBase58Check + a.AssociationValue;
      map.set(conversationKey, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }

  return map;
}

export async function createArchiveAssociation(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_ARCHIVED,
      AssociationValue: groupKeyName,
    }, { checkPermissions: false })
  );
}

export async function deleteArchiveAssociation(
  myPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationID: associationId,
    })
  );
}

// ── DM archive (hide a DM conversation) ────────────────────────────

export async function createArchiveChatAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: targetPublicKey,
      AssociationType: ASSOCIATION_TYPE_CHAT_ARCHIVED,
      AssociationValue: ASSOCIATION_VALUE_ARCHIVED,
    }, { checkPermissions: false })
  );
}

export async function deleteAssociationById(
  myPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationID: associationId,
    })
  );
}

// ── Dismiss request ─────────────────────────────────────────────────

export async function createDismissAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: targetPublicKey,
      AssociationType: ASSOCIATION_TYPE_DISMISSED,
      AssociationValue: ASSOCIATION_VALUE_DISMISSED,
    }, { checkPermissions: false })
  );
}

// ── Privacy mode (on-chain preference) ──────────────────────────────

/**
 * Fetch the user's privacy mode from on-chain associations.
 * Self-referencing association: transactor = target = the user.
 * Returns { mode, associationId } or defaults to "full".
 */
export async function fetchPrivacyMode(
  publicKey: string
): Promise<{ mode: PrivacyMode; associationId: string | null }> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
      Limit: 1,
    });

    const assoc = res.Associations?.[0];
    if (assoc) {
      const value = assoc.AssociationValue;
      const mode: PrivacyMode = value === "full" ? "full" : "standard";
      return { mode, associationId: assoc.AssociationID };
    }
  } catch (e) {
    console.error("Failed to fetch privacy mode association:", e);
  }
  return { mode: "full", associationId: null };
}

/**
 * Create or update the user's privacy mode on-chain.
 * If an existing association exists, delete it first (DeSo doesn't support
 * updating association values — must delete + recreate).
 */
export async function setPrivacyModeOnChain(
  myPublicKey: string,
  mode: PrivacyMode,
  existingAssociationId: string | null
): Promise<string> {
  // Delete old association if it exists
  if (existingAssociationId) {
    await withAuth(() =>
      deleteUserAssociation({
        TransactorPublicKeyBase58Check: myPublicKey,
        AssociationID: existingAssociationId,
      })
    );
  }

  // Only create on-chain if not the default — avoids unnecessary transactions
  if (mode === PRIVACY_MODE_FULL && !existingAssociationId) {
    return "";
  }

  const { submittedTransactionResponse } = await withAuth(() =>
    createUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: myPublicKey, // self-association
      AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
      AssociationValue: mode,
    }, { checkPermissions: false })
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: myPublicKey,
    AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
    Limit: 1,
  });

  return res.Associations?.[0]?.AssociationID || "";
}

// ─── Group Join Requests ─────────────────────────────────────────────

/**
 * Create a join request association (requester → group owner).
 */
export async function createJoinRequest(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
        AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
        AssociationValue: groupKeyName,
      },
      { checkPermissions: false }
    )
  );
}

/**
 * Check whether the current user already has a pending join request for a group.
 */
export async function hasExistingJoinRequest(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<boolean> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      AssociationValue: groupKeyName,
      Limit: 1,
    });
    return (res.Associations?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch join request counts for all groups owned by the current user.
 * Returns a Map<conversationKey, count> for groups with pending requests.
 * Lightweight: no profile data fetched.
 */
export async function fetchJoinRequestCountsForOwner(
  ownerPublicKey: string
): Promise<Map<string, number>> {
  // First pass: collect all associations and requester keys per group
  const groupRequesters = new Map<string, Set<string>>(); // groupKeyName → requester keys
  let lastId = "";

  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      const groupKeyName = a.AssociationValue;
      if (!groupRequesters.has(groupKeyName)) {
        groupRequesters.set(groupKeyName, new Set());
      }
      groupRequesters.get(groupKeyName)!.add(a.TransactorPublicKeyBase58Check);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }

  if (groupRequesters.size === 0) return new Map();

  // Second pass: fetch members for each group and filter out already-members
  const counts = new Map<string, number>();
  await Promise.all(
    Array.from(groupRequesters.entries()).map(
      async ([groupKeyName, requesterKeys]) => {
        const conversationKey = ownerPublicKey + groupKeyName;
        try {
          const memberSet = new Set<string>([ownerPublicKey]);
          let cursor = "";
          while (true) {
            const membersRes = await getPaginatedAccessGroupMembers({
              AccessGroupOwnerPublicKeyBase58Check: ownerPublicKey,
              AccessGroupKeyName: groupKeyName,
              MaxMembersToFetch: 100,
              ...(cursor
                ? { StartingAccessGroupMemberPublicKeyBase58Check: cursor }
                : {}),
            });
            const pageKeys = membersRes?.AccessGroupMembersBase58Check ?? [];
            for (const k of pageKeys) memberSet.add(k);
            if (pageKeys.length < 100) break;
            cursor = pageKeys[pageKeys.length - 1];
          }
          const pendingCount = Array.from(requesterKeys).filter(
            (k) => !memberSet.has(k)
          ).length;
          if (pendingCount > 0) {
            counts.set(conversationKey, pendingCount);
          }
        } catch {
          // Fallback to raw count if member fetch fails
          counts.set(conversationKey, requesterKeys.size);
        }
      }
    )
  );

  return counts;
}

export interface JoinRequestEntry {
  requesterPublicKey: string;
  associationId: string;
  profile: import("deso-protocol").ProfileEntryResponse | null;
}

/**
 * Fetch all pending join requests for a group owned by `ownerPublicKey`.
 * Returns requester public keys, association IDs, and profiles.
 */
export async function fetchPendingJoinRequests(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<JoinRequestEntry[]> {
  const results: JoinRequestEntry[] = [];
  let lastId = "";

  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      AssociationValue: groupKeyName,
      IncludeTransactorProfile: true,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    const profileMap = res.PublicKeyToProfileEntryResponse ?? {};
    for (const a of associations) {
      results.push({
        requesterPublicKey: a.TransactorPublicKeyBase58Check,
        associationId: a.AssociationID,
        profile:
          a.TransactorProfile ??
          profileMap[a.TransactorPublicKeyBase58Check] ??
          null,
      });
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }

  return results;
}

/**
 * Self-cleanup: delete the current user's own join request associations
 * for groups they are already a member of. The requester is the transactor,
 * so they CAN delete their own associations. Call on app startup or when
 * the user visits a join page and is already a member.
 */
export async function cleanupOwnJoinRequests(
  myPublicKey: string,
  myAccessGroups: import("deso-protocol").AccessGroupEntryResponse[]
): Promise<void> {
  // Fetch all join request associations created by this user
  let lastId = "";
  const toDelete: string[] = [];

  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      // Check if the user is now a member of this group
      const isMember = myAccessGroups.some(
        (g) =>
          g.AccessGroupOwnerPublicKeyBase58Check ===
            a.TargetUserPublicKeyBase58Check &&
          g.AccessGroupKeyName === a.AssociationValue
      );
      if (isMember) {
        toDelete.push(a.AssociationID);
      }
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }

  // Delete resolved join requests (best-effort, fire-and-forget)
  if (toDelete.length > 0) {
    await Promise.allSettled(
      toDelete.map((id) =>
        deleteUserAssociation(
          {
            TransactorPublicKeyBase58Check: myPublicKey,
            AssociationID: id,
          },
          { checkPermissions: false }
        )
      )
    );
  }
}
