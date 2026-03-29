import {
  AccessGroupEntryResponse,
  ChatType,
  checkPartyAccessGroups,
  createUserAssociation,
  DecryptedMessageEntryResponse,
  getAllAccessGroups,
  getAllMessageThreads,
  getFollowersForUser,
  getUserAssociations,
  identity,
  NewMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  sendDMMessage,
  sendGroupChatMessage,
  waitForTransactionFound,
} from "deso-protocol";
import { toast } from "sonner";
import { withAuth } from "../utils/with-auth";
import {
  ASSOCIATION_TYPE_APPROVED,
  ASSOCIATION_TYPE_BLOCKED,
  ASSOCIATION_VALUE_APPROVED,
  ASSOCIATION_VALUE_BLOCKED,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  USER_TO_SEND_MESSAGE_TO,
} from "../utils/constants";
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

export const decryptAccessGroupMessages = (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> => {
  return Promise.all(
    (messages || []).map((m) => identity.decryptMessage(m, accessGroups))
  );
};

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
  myPublicKey: string,
  mutualFollows: Set<string>,
  approvedUsers: Set<string>,
  blockedUsers: Set<string>,
  initiatedChats: Set<string>
): "chat" | "request" | "blocked" {
  if (conversation.ChatType === ChatType.GROUPCHAT) return "chat";

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
