import {
  AccessGroupEntryResponse,
  ChatType,
  checkPartyAccessGroups,
  createUserAssociation,
  DecryptedMessageEntryResponse,
  deleteUserAssociation,
  getAllAccessGroups,
  getAllMessageThreads,
  getFollowersForUser,
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
  ASSOCIATION_TYPE_GROUP_ARCHIVED,
  ASSOCIATION_VALUE_APPROVED,
  ASSOCIATION_VALUE_BLOCKED,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  USER_TO_SEND_MESSAGE_TO,
} from "../utils/constants";
import {
  ENCRYPTED_EXTRA_DATA_KEYS,
  MSG_ENCRYPTED,
} from "../utils/extra-data";
import { Conversation, ConversationMap } from "../utils/types";
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

  // Naive approach to figuring out which access groups we need to fetch.
  const accessGroupsToFetch = decryptedMessageEntries.filter(
    (dmr) => dmr.error === "Error: access group key not found for group message"
  );
  if (accessGroupsToFetch.length > 0) {
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

/**
 * If a message has encrypted ExtraData values (flagged by msg:encrypted),
 * decrypt each one by feeding it through identity.decryptMessage as a
 * fake message. This reuses the SDK's DM-vs-group key resolution so we
 * don't need to reimplement it.
 */
async function decryptExtraDataFields(
  msg: DecryptedMessageEntryResponse,
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse> {
  const extra = msg.MessageInfo?.ExtraData;
  if (!extra || extra[MSG_ENCRYPTED] !== "true") return msg;

  const updatedExtra = { ...extra };

  for (const key of ENCRYPTED_EXTRA_DATA_KEYS) {
    const cipherText = updatedExtra[key];
    if (!cipherText) continue;

    try {
      // Build a shallow message clone with the encrypted ExtraData value
      // swapped into EncryptedText so identity.decryptMessage can decrypt it
      // using the correct key (messaging key for DMs, group key for groups).
      const fakeMsg = {
        ...msg,
        MessageInfo: {
          ...msg.MessageInfo,
          EncryptedText: cipherText,
          // Remove the unencrypted flag so the SDK decrypts instead of hex-decoding
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

    // Encrypt sensitive ExtraData values with the same recipient key
    let hasEncrypted = false;
    for (const key of ENCRYPTED_EXTRA_DATA_KEYS) {
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

    // Encrypt sensitive ExtraData values with the same recipient key
    let hasEncrypted = false;
    for (const key of ENCRYPTED_EXTRA_DATA_KEYS) {
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

export async function fetchChatAssociations(
  publicKey: string
): Promise<{
  approved: Map<string, string>;
  blocked: Map<string, string>;
}> {
  const fetchAll = async (associationType: string) => {
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
  };

  const [approved, blocked] = await Promise.all([
    fetchAll(ASSOCIATION_TYPE_APPROVED),
    fetchAll(ASSOCIATION_TYPE_BLOCKED),
  ]);

  return { approved, blocked };
}

export function classifyConversation(
  conversation: Conversation,
  conversationKey: string,
  myPublicKey: string,
  mutualFollows: Set<string>,
  approvedUsers: Set<string>,
  blockedUsers: Set<string>,
  initiatedChats: Set<string>,
  archivedGroups: Set<string>
): "chat" | "request" | "blocked" | "archived" {
  if (conversation.ChatType === ChatType.GROUPCHAT) {
    if (archivedGroups.has(conversationKey)) return "archived";
    return "chat";
  }

  const otherKey = conversation.firstMessagePublicKey;

  if (blockedUsers.has(otherKey)) return "blocked";
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
    })
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
    })
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
    })
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
