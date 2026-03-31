import { Loader2, CheckCircle, Bell, BellOff, Archive, EllipsisVertical, ShieldBan } from "lucide-react";
import { useStore } from "../store";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedAccessGroupMembers,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  getUsersStateless,
  NewMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import { useInterval } from "hooks/useInterval";
import { FC, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useMessageSearch } from "../hooks/useMessageSearch";
import { useMobile } from "../hooks/useMobile";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTypingIndicator, useTypingDisplay } from "../hooks/useTypingIndicator";
import { needsPermissionUpgrade, requestFullPermissions } from "../utils/with-auth";
import {
  classifyConversation,
  createApprovalAssociation,
  createArchiveChatAssociation,
  createArchiveAssociation,
  createBlockAssociation,
  createDismissAssociation,
  decryptAccessGroupMessagesWithRetry,
  deleteArchiveAssociation,
  deleteAssociationById,
  encryptAndSendNewMessage,
  encryptAndUpdateMessage,
  fetchArchivedGroups,
  fetchAssociationsByType,
  fetchChatAssociations,
  fetchMutualFollows,
  fetchPrivacyMode,
  getConversations,
} from "../services/conversations.service";
import {
  cacheConversations,
  cacheConversationMessages,
  cacheLastConversationKey,
  cacheLastReadTimestamp,
  cacheUsernameMap,
  syncUnreadConversations,
  removeUnreadConversation,
  getCachedClassificationData,
  getCachedConversationMessages,
  getCachedConversations,
  getCachedLastConversationKey,
  getCachedLastReadTimestamps,
  getCachedMutedConversations,
  getCachedPrivacyMode,
  getCachedUsernameMap,
  getCachedUserProfile,
} from "../services/cache.service";
import {
  ASSOCIATION_TYPE_BLOCKED,
  ASSOCIATION_TYPE_CHAT_ARCHIVED,
  ASSOCIATION_TYPE_DISMISSED,
  BASE_TITLE,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN,
  MAX_MEMBERS_TO_REQUEST_IN_GROUP,
  MESSAGES_ONE_REQUEST_LIMIT,
  PUBLIC_KEY_LENGTH,
  PUBLIC_KEY_PREFIX,
  REFRESH_MESSAGES_INTERVAL_MS,
  REFRESH_MESSAGES_MOBILE_INTERVAL_MS,
  TITLE_DIVIDER,
} from "../utils/constants";
import {
  getChatNameFromConversation,
  hasSetupMessaging,
  scrollContainerToElement,
} from "../utils/helpers";
import { Conversation, ConversationMap } from "../utils/types";
import { buildExtraData, getGroupImageUrl, MSG_REPLY_TO, MSG_REPLY_PREVIEW } from "../utils/extra-data";
import { ManageMembersDialog } from "./manage-members-dialog";
import { MessagingBubblesAndAvatar } from "./messaging-bubbles";
import { MessagingConversationAccount } from "./messaging-conversation-accounts";
import { MessagingConversationButton } from "./messaging-conversation-button";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessagingSetupButton } from "./messaging-setup-button";
import { OnboardingWizard, isOnboardingComplete, markOnboardingComplete } from "./onboarding/onboarding-wizard";
import { shortenLongWord } from "./search-users";
import { SendMessageButtonAndInput } from "./send-message-button-and-input";
import {
  addPendingMessage,
  removePendingMessage,
  getPendingMessages,
  clearPendingMessages,
  type PendingMessage,
} from "../services/pending-messages.service";
import {
  getHiddenMessageIds,
  hideMessage,
} from "../services/hidden-messages.service";

export const MockBubble: FC<{
    username: string;
    avatar: string;
    timestamp: string;
    text: string;
    direction: string;
  }> = ({
    username,
    avatar,
    timestamp,
    text,
    direction = "left",
  }) => {
  return (
    <>
      { direction == "receiver" && (
        <div className="flex flex-row items-start gap-3">
          <div className="flex flex-col w-[60px] top-2 relative justify-center items-center">
            <img src={avatar} className="w-[38px] rounded-full mb-2"/>
            <span className="whitespace-nowrap text-xs text-gray-500">{timestamp}</span>
          </div>
          <div className="flex flex-col items-start">
            <div className="mb-2 text-[#34F080] text-xs">{username}</div>
            <div className="text-xs w-auto bg-[#141c2b] border border-white/6 rounded-2xl rounded-bl-sm pl-5 mt-auto mb-2 md:mb-5 py-2 px-2 md:px-4 text-white break-words flex text-left relative items-center">
              <div className="text-white text-sm">{text}</div>
            </div>
          </div>
        </div>
      )}
      { direction == "sender" && (
        <div className="flex flex-row-reverse items-start gap-3">
          <div className="flex flex-col w-[60px] justify-center items-center">
            <img src={avatar} className="w-[38px] rounded-full mb-2"/>
            <span className="whitespace-nowrap text-xs text-gray-500">{timestamp}</span>
          </div>
          <div className="flex flex-col items-end">
            <div className="mb-2 text-[#34F080] text-xs">{username}</div>
            <div className="bg-[#0d2818] border border-[#34F080]/15 text-white rounded-2xl rounded-br-sm pl-5 mt-auto mb-2 md:mb-5 py-2 px-2 md:px-4 break-words inline-flex text-left relative items-center">
              <div className="text-white text-sm">{text}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const MessagingApp: FC = () => {
  const {
    appUser, isLoadingUser, allAccessGroups, setAllAccessGroups, lockRefresh, setLockRefresh,
    mutualFollows, approvedUsers, blockedUsers, initiatedChats, chatRequestsLoaded,
    archivedGroups, archivedGroupAssociationIds,
    archivedChats, archivedChatAssociationIds,
    dismissedUsers, dismissedAssociationIds,
    blockedAssociationIds,
    setClassificationData, addInitiatedChat, approveUser, rollbackApproval,
    blockUser, rollbackBlock, archiveGroup, unarchiveGroup, rollbackArchive, rollbackUnarchive, mergeArchivedGroupIds,
    archiveChat, unarchiveChat, rollbackArchiveChat, rollbackUnarchiveChat, mergeArchivedChatIds,
    dismissUser, undismissUser, rollbackDismiss, rollbackUndismiss, mergeDismissedIds,
    unblockUser, rollbackUnblock,
    unreadByConversation, clearUnread, initializeUnread,
    mutedConversations, toggleMute,
  } = useStore();
  const [usernameByPublicKeyBase58Check, setUsernameByPublicKeyBase58Check] =
    useState<{ [key: string]: string }>({});
  const [profilePicByPublicKey, setProfilePicByPublicKey] =
    useState<{ [key: string]: string }>({});
  const [autoFetchConversations, setAutoFetchConversations] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pubKeyPlusGroupName, setPubKeyPlusGroupName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [selectedConversationPublicKey, setSelectedConversationPublicKey] =
    useState("");
  const [conversations, setConversations] = useState<ConversationMap>({});
  const [membersByGroupKey, setMembersByGroupKey] = useState<{
    [groupKey: string]: PublicKeyToProfileEntryResponseMap;
  }>({});
  const [replyToMessage, setReplyToMessage] = useState<{
    text: string;
    timestamp: string;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    text: string;
    timestamp: string;
  } | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  const [dmMenuOpen, setDmMenuOpen] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState<{ conversationKey: string; publicKey: string; name: string } | null>(null);
  const { isMobile } = useMobile();

  // Message search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isSearching: isMessageSearching,
    isDeepSearching,
    progress: searchProgress,
    clearSearch,
  } = useMessageSearch({
    userPublicKey: appUser?.PublicKeyBase58Check || "",
    conversations,
    usernameMap: usernameByPublicKeyBase58Check,
    allAccessGroups,
  });

  const [searchClearTrigger, setSearchClearTrigger] = useState(0);

  const handleSearchResultClick = useCallback(
    (conversationKey: string) => {
      clearSearch();
      setSearchClearTrigger((n) => n + 1);
      setSelectedConversationPublicKey(conversationKey);
      setPubKeyPlusGroupName(conversationKey);
    },
    [clearSearch]
  );

  // Refs for accessing latest state inside callbacks without causing re-renders
  const lockRefreshRef = useRef(lockRefresh);
  lockRefreshRef.current = lockRefresh;
  const selectedConversationPublicKeyRef = useRef(
    selectedConversationPublicKey
  );
  selectedConversationPublicKeyRef.current = selectedConversationPublicKey;

  // Shared merge logic: reconcile optimistic messages with blockchain-confirmed data.
  // Used by both the WebSocket handler and the polling interval.
  const mergeConversationUpdate = useCallback(
    (
      updatedConversations: ConversationMap,
      selectedKey: string,
      updatedMessages: DecryptedMessageEntryResponse[]
    ) => {
      setConversations((prev) => {
        const currentMessages = prev[selectedKey]?.messages || [];

        const optimisticMessages = currentMessages.filter(
          (m: any) => m._localId && m._status !== "sent"
        );

        const confirmedKeys = new Set(
          updatedMessages.map(
            (m) =>
              m.SenderInfo.OwnerPublicKeyBase58Check +
              ":" +
              m.DecryptedMessage?.slice(0, 50)
          )
        );

        const stillPendingOptimistic = optimisticMessages.filter(
          (m: any) =>
            !confirmedKeys.has(
              m.SenderInfo.OwnerPublicKeyBase58Check +
                ":" +
                m.DecryptedMessage?.slice(0, 50)
            )
        );

        const merged = {
          ...prev,
          [selectedKey]: {
            ...prev[selectedKey],
            messages: [...stillPendingOptimistic, ...updatedMessages],
          },
        };

        if (appUser) {
          cacheConversations(appUser.PublicKeyBase58Check, merged);
          cacheConversationMessages(
            appUser.PublicKeyBase58Check,
            selectedKey,
            updatedMessages
          );
        }

        return merged;
      });
    },
    [appUser]
  );

  // Lightweight merge for conversations we're not currently viewing:
  // keeps optimistic messages, layers in fresh blockchain data.
  // IMPORTANT: The `updated` map comes from getConversations() which only
  // carries the latest ~1 message per conversation. For the currently viewed
  // conversation we already have a full thread loaded, so we must NOT replace
  // its messages — only update metadata (firstMessagePublicKey, ChatType).
  const simpleConversationMerge = useCallback(
    (updated: ConversationMap) => {
      setConversations((prev) => {
        const merged = { ...prev };
        const currentKey = selectedConversationPublicKeyRef.current;
        for (const [key, convo] of Object.entries(updated)) {
          if (!merged[key]) {
            merged[key] = convo;
          } else if (key === currentKey) {
            // Preserve the full thread; only refresh conversation metadata
            merged[key] = { ...convo, messages: merged[key].messages };
          } else {
            const optimistic = merged[key].messages.filter((m: any) => m._localId);
            merged[key] = { ...convo, messages: [...optimistic, ...convo.messages] };
          }
        }
        if (appUser) cacheConversations(appUser.PublicKeyBase58Check, merged);
        return merged;
      });
    },
    [appUser]
  );

  // Guard against concurrent WS-triggered fetches (e.g. rapid-fire notifications)
  const wsFetchingRef = useRef(false);
  // Guard against overlapping polling ticks (setInterval fires even if previous callback is still async)
  const pollingRef = useRef(false);

  // Real-time WebSocket relay
  const handleWsNewMessage = useCallback(
    (threadId: string, _from: string) => {
      if (!appUser || wsFetchingRef.current) return;
      wsFetchingRef.current = true;

      getConversations(appUser.PublicKeyBase58Check, allAccessGroups).then(
        async ({ conversations: updated, updatedAllAccessGroups }) => {
          setAllAccessGroups(updatedAllAccessGroups);

          const currentSelectedKey = selectedConversationPublicKeyRef.current;

          // The sender passes their own conversation key as threadId, but for
          // DMs the recipient indexes the same conversation under the sender's
          // public key. Resolve to the local key so comparisons and unread
          // tracking use the correct key.
          let localThreadId = threadId;
          if (threadId && !updated[threadId] && _from) {
            const candidateKey = _from + DEFAULT_KEY_MESSAGING_GROUP_NAME;
            if (updated[candidateKey]) {
              localThreadId = candidateKey;
            }
          }

          if (localThreadId && localThreadId === currentSelectedKey) {
            // Notification is for the conversation we're looking at —
            // fetch the full thread so new messages appear immediately.
            try {
              const { updatedConversations, pubKeyPlusGroupName: newPubKey } =
                await getConversation(currentSelectedKey, {
                  ...updated,
                  [currentSelectedKey]: updated[currentSelectedKey],
                });

              // Guard: user may have switched conversations during the await —
              // still merge the conversation list so new chats appear, but skip
              // the full-thread merge and pubKeyPlusGroupName update.
              if (selectedConversationPublicKeyRef.current !== currentSelectedKey) {
                simpleConversationMerge(updated);
                return;
              }

              const updatedMessages =
                updatedConversations[currentSelectedKey]?.messages;
              if (updatedMessages) {
                mergeConversationUpdate(
                  updatedConversations,
                  currentSelectedKey,
                  updatedMessages
                );
                setPubKeyPlusGroupName(newPubKey);
                // Update last-read since user is viewing this conversation
                if (updatedMessages[0]) {
                  cacheLastReadTimestamp(
                    appUser.PublicKeyBase58Check,
                    currentSelectedKey,
                    updatedMessages[0].MessageInfo.TimestampNanos
                  );
                }
              }
            } catch {
              // Fall back to the simple conversation-list merge
              simpleConversationMerge(updated);
            }
          } else {
            // Different conversation — just merge the conversation list
            simpleConversationMerge(updated);

            const isDmConvo = updated[localThreadId]?.ChatType === ChatType.DM;
            if (localThreadId && !useStore.getState().mutedConversations.has(localThreadId) && !useStore.getState().archivedGroups.has(localThreadId) && !(isDmConvo && _from && useStore.getState().blockedUsers.has(_from)) && !(isDmConvo && _from && useStore.getState().dismissedUsers.has(_from)) && !(isDmConvo && _from && useStore.getState().archivedChats.has(_from))) {
              useStore.getState().incrementUnread(localThreadId);
            } else if (!localThreadId) {
              // Resume from background — fetch full thread and compute
              // unread in parallel (they're independent operations).
              const threadPromise =
                currentSelectedKey && updated[currentSelectedKey]
                  ? getConversation(currentSelectedKey, {
                      ...updated,
                      [currentSelectedKey]: updated[currentSelectedKey],
                    }).then(({ updatedConversations, pubKeyPlusGroupName: newPubKey }) => {
                      // Guard: user may have switched conversations during the await
                      if (selectedConversationPublicKeyRef.current !== currentSelectedKey) return;
                      const updatedMessages =
                        updatedConversations[currentSelectedKey]?.messages;
                      if (updatedMessages) {
                        mergeConversationUpdate(
                          updatedConversations,
                          currentSelectedKey,
                          updatedMessages
                        );
                        setPubKeyPlusGroupName(newPubKey);
                        if (updatedMessages[0]) {
                          cacheLastReadTimestamp(
                            appUser.PublicKeyBase58Check,
                            currentSelectedKey,
                            updatedMessages[0].MessageInfo.TimestampNanos
                          );
                        }
                      }
                    }).catch(() => {
                      // Full thread fetch failed — simple merge already applied above
                    })
                  : Promise.resolve();

              // Compute unread from timestamps (no await needed — sync reads)
              const lastReadTimestamps = getCachedLastReadTimestamps(appUser.PublicKeyBase58Check);
              const store = useStore.getState();
              const unreadMap = new Map<string, number>();
              for (const [k, convo] of Object.entries(updated)) {
                if (k === currentSelectedKey) continue;
                if (store.mutedConversations.has(k) || store.archivedGroups.has(k)) continue;
                const latestMsg = convo.messages[0];
                if (!latestMsg || latestMsg.IsSender) continue;
                const msgTs = latestMsg.MessageInfo.TimestampNanos;
                const lastRead = lastReadTimestamps[k];
                if (lastRead === undefined) {
                  cacheLastReadTimestamp(appUser.PublicKeyBase58Check, k, msgTs);
                } else if (msgTs > lastRead) {
                  unreadMap.set(k, 1);
                }
              }
              syncUnreadConversations(Array.from(unreadMap.keys()));
              if (unreadMap.size > 0) {
                useStore.getState().initializeUnread(unreadMap);
              } else {
                navigator.clearAppBadge?.();
              }

              // Wait for thread fetch before releasing wsFetchingRef
              await threadPromise;
            }
          }
        }
      ).catch(() => {}).finally(() => { wsFetchingRef.current = false; });
    },
    [appUser, allAccessGroups, mergeConversationUpdate, simpleConversationMerge]
  );

  const { onTypingReceived, getTypingUsersForConversation } = useTypingDisplay();

  const { sendNotify, sendTyping, sendRead } = useWebSocket({
    onNewMessage: handleWsNewMessage,
    onTyping: onTypingReceived,
  });

  const { onKeystroke } = useTypingIndicator(sendTyping);

  // Derive classified conversation maps from the single conversations state + store Sets
  const { chatConversations, requestConversations, archivedConversations } = useMemo(() => {
    if (!appUser) return { chatConversations: {} as ConversationMap, requestConversations: {} as ConversationMap, archivedConversations: {} as ConversationMap };
    const chats: ConversationMap = {};
    const requests: ConversationMap = {};
    const archived: ConversationMap = {};
    for (const [key, convo] of Object.entries(conversations)) {
      const cls = classifyConversation(
        convo, key, appUser.PublicKeyBase58Check,
        mutualFollows, approvedUsers, blockedUsers, initiatedChats, archivedGroups,
        archivedChats, dismissedUsers
      );
      if (cls === "chat") chats[key] = convo;
      else if (cls === "request") requests[key] = convo;
      else if (cls === "archived") archived[key] = convo;
      // "blocked" and "dismissed" → omitted
    }
    return { chatConversations: chats, requestConversations: requests, archivedConversations: archived };
  }, [conversations, mutualFollows, approvedUsers, blockedUsers, initiatedChats, archivedGroups, archivedChats, dismissedUsers, appUser]);

  // Clean up UI state after a conversation's classification changes
  const cleanupAfterClassificationChange = (conversationKey: string) => {
    // Clear selection if the user is viewing this conversation
    if (selectedConversationPublicKey === conversationKey) {
      setSelectedConversationPublicKey("");
    }
    // Clear any unread badge for this conversation
    clearUnread(conversationKey);
    removeUnreadConversation(conversationKey);
    // Clear search results so stale conversations don't appear
    if (searchQuery) {
      clearSearch();
      setSearchClearTrigger((n) => n + 1);
    }
  };

  const handleAcceptRequest = async (conversationKey: string, publicKey: string) => {
    if (!appUser) return;
    approveUser(publicKey);
    // Clear search so the conversation appears in the right tab
    if (searchQuery) {
      clearSearch();
      setSearchClearTrigger((n) => n + 1);
    }
    try {
      await createApprovalAssociation(appUser.PublicKeyBase58Check, publicKey);
    } catch (e) {
      rollbackApproval(publicKey);
      toast.error("Failed to accept chat request");
    }
  };

  const handleBlockRequest = async (conversationKey: string, publicKey: string) => {
    if (!appUser) return;
    blockUser(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createBlockAssociation(appUser.PublicKeyBase58Check, publicKey);
      toast("User blocked", {
        action: { label: "Undo", onClick: () => handleUnblock(publicKey) },
      });
      // Background-fetch the association ID so unblock works
      fetchAssociationsByType(appUser.PublicKeyBase58Check, ASSOCIATION_TYPE_BLOCKED)
        .then((ids) => {
          const current = useStore.getState().blockedAssociationIds;
          const next = new Map(current);
          for (const [k, v] of ids) next.set(k, v);
          useStore.setState({ blockedAssociationIds: next });
        })
        .catch(() => {});
    } catch (e) {
      rollbackBlock(publicKey);
      toast.error("Failed to block user");
    }
  };

  const handleArchiveGroup = async (conversationKey: string, groupOwnerPublicKey: string, groupKeyName: string) => {
    if (!appUser) return;
    archiveGroup(conversationKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createArchiveAssociation(appUser.PublicKeyBase58Check, groupOwnerPublicKey, groupKeyName);
      toast("Left group chat", {
        action: { label: "Undo", onClick: () => handleUnarchiveGroup(conversationKey) },
      });
      // Background: fetch the association ID so Rejoin works without page refresh
      fetchArchivedGroups(appUser.PublicKeyBase58Check)
        .then((ids) => mergeArchivedGroupIds(ids))
        .catch(() => {});
    } catch (e) {
      rollbackArchive(conversationKey);
      toast.error("Failed to leave group");
    }
  };

  const handleUnarchiveGroup = async (conversationKey: string) => {
    if (!appUser) return;
    const associationId = useStore.getState().archivedGroupAssociationIds.get(conversationKey);
    if (!associationId) {
      toast.error("Cannot rejoin — association not found");
      return;
    }
    unarchiveGroup(conversationKey);
    try {
      await deleteArchiveAssociation(appUser.PublicKeyBase58Check, associationId);
      toast.success("Rejoined group chat");
    } catch (e) {
      rollbackUnarchive(conversationKey, associationId);
      toast.error("Failed to rejoin group");
    }
  };

  // ── Archive DM chat ──
  const handleArchiveChat = async (conversationKey: string, publicKey: string) => {
    if (!appUser) return;
    archiveChat(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createArchiveChatAssociation(appUser.PublicKeyBase58Check, publicKey);
      toast("Chat archived", {
        action: { label: "Undo", onClick: () => handleUnarchiveChat(publicKey) },
      });
      // Background-fetch the association ID so unarchive works
      fetchAssociationsByType(appUser.PublicKeyBase58Check, ASSOCIATION_TYPE_CHAT_ARCHIVED)
        .then((ids) => mergeArchivedChatIds(ids))
        .catch(() => {});
    } catch (e) {
      rollbackArchiveChat(publicKey);
      toast.error("Failed to archive chat");
    }
  };

  const handleUnarchiveChat = async (publicKey: string) => {
    if (!appUser) return;
    // Read latest from store — not the stale closure — since the ID arrives via background fetch
    const associationId = useStore.getState().archivedChatAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error("Cannot unarchive — association not found. Try again in a moment.");
      return;
    }
    unarchiveChat(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("Chat unarchived");
    } catch (e) {
      rollbackUnarchiveChat(publicKey, associationId);
      toast.error("Failed to unarchive chat");
    }
  };

  // ── Dismiss request ──
  const handleDismissRequest = async (conversationKey: string, publicKey: string) => {
    if (!appUser) return;
    dismissUser(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createDismissAssociation(appUser.PublicKeyBase58Check, publicKey);
      toast("Request dismissed", {
        action: { label: "Undo", onClick: () => handleUndismiss(publicKey) },
      });
      // Background-fetch the association ID so undo works
      fetchAssociationsByType(appUser.PublicKeyBase58Check, ASSOCIATION_TYPE_DISMISSED)
        .then((ids) => mergeDismissedIds(ids))
        .catch(() => {});
    } catch (e) {
      rollbackDismiss(publicKey);
      toast.error("Failed to dismiss request");
    }
  };

  const handleUndismiss = async (publicKey: string) => {
    if (!appUser) return;
    const associationId = useStore.getState().dismissedAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error("Cannot undo — association not found. Try again in a moment.");
      return;
    }
    undismissUser(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("Request restored");
    } catch (e) {
      rollbackUndismiss(publicKey, associationId);
      toast.error("Failed to restore request");
    }
  };

  // ── Unblock user ──
  const handleUnblock = async (publicKey: string) => {
    if (!appUser) return;
    const associationId = useStore.getState().blockedAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error("Cannot unblock — association not found. Try again in a moment.");
      return;
    }
    unblockUser(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("User unblocked");
    } catch (e) {
      rollbackUnblock(publicKey, associationId);
      toast.error("Failed to unblock user");
    }
  };

  // Retry a single pending message (used by startup retry and the retry button)
  const retryingIds = useRef(new Set<string>());
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const retryPendingMessage = useCallback(
    async (pending: PendingMessage) => {
      if (!appUser) return;
      const { localId, conversationKey, messageText, recipientPublicKey, recipientAccessGroupKeyName, extraData, senderPublicKey } = pending;

      // Don't retry messages from a different account
      if (senderPublicKey && senderPublicKey !== appUser.PublicKeyBase58Check) return;

      // Guard against concurrent retries for the same message
      if (retryingIds.current.has(localId)) return;
      retryingIds.current.add(localId);

      // Insert optimistic message into conversations if not already present
      const TimestampNanos = pending.createdAt * 1e6;
      const mockMessage = {
        DecryptedMessage: messageText,
        IsSender: true,
        _status: "sending" as const,
        _localId: localId,
        SenderInfo: {
          OwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        },
        RecipientInfo: {
          OwnerPublicKeyBase58Check: recipientPublicKey,
          AccessGroupKeyName: recipientAccessGroupKeyName,
        },
        MessageInfo: {
          TimestampNanos,
          TimestampNanosString: String(TimestampNanos),
          ExtraData: extraData || {},
        },
      } as DecryptedMessageEntryResponse & { _status: string; _localId: string };

      // Check if this message already landed on-chain (app closed after
      // blockchain accepted but before we could remove from IndexedDB).
      // Uses the same dedup key as the poll reconciliation: sender + first 50 chars.
      const dedupeKey = appUser.PublicKeyBase58Check + ":" + messageText.slice(0, 50);
      const convo = conversationsRef.current[conversationKey];
      if (convo) {
        const alreadyOnChain = convo.messages.some(
          (m: any) =>
            !m._localId &&
            m.SenderInfo.OwnerPublicKeyBase58Check + ":" + m.DecryptedMessage?.slice(0, 50) === dedupeKey
        );
        if (alreadyOnChain) {
          // Message already confirmed — just clean up
          removePendingMessage(appUser.PublicKeyBase58Check, localId);
          // Remove the optimistic entry if it's lingering in state
          setConversations((prev) => {
            if (!prev[conversationKey]) return prev;
            return {
              ...prev,
              [conversationKey]: {
                ...prev[conversationKey],
                messages: prev[conversationKey].messages.filter(
                  (m: any) => m._localId !== localId
                ),
              },
            };
          });
          retryingIds.current.delete(localId);
          return;
        }
      }

      // Upsert: update existing failed message or insert fresh.
      // If the conversation hasn't loaded yet, create a minimal placeholder so
      // the retry still fires the blockchain call.
      setConversations((prev) => {
        const c = prev[conversationKey];
        if (!c) {
          return {
            ...prev,
            [conversationKey]: {
              ChatType: ChatType.DM,
              firstMessagePublicKey: recipientPublicKey,
              messages: [mockMessage],
            },
          };
        }
        const exists = c.messages.some((m: any) => m._localId === localId);
        return {
          ...prev,
          [conversationKey]: {
            ...c,
            messages: exists
              ? c.messages.map((m: any) =>
                  m._localId === localId ? { ...m, _status: "sending" } : m
                )
              : [mockMessage, ...c.messages],
          },
        };
      });

      try {
        await encryptAndSendNewMessage(
          messageText,
          appUser.PublicKeyBase58Check,
          recipientPublicKey,
          recipientAccessGroupKeyName,
          DEFAULT_KEY_MESSAGING_GROUP_NAME,
          extraData
        );
        removePendingMessage(appUser.PublicKeyBase58Check, localId);
        notifyConversation(
          conversationKey,
          recipientPublicKey,
          usernameByPublicKeyBase58Check[appUser.PublicKeyBase58Check] || appUser.PublicKeyBase58Check
        );
        setConversations((prev) => {
          if (!prev[conversationKey]) return prev;
          return {
            ...prev,
            [conversationKey]: {
              ...prev[conversationKey],
              messages: prev[conversationKey].messages.map((m: any) =>
                m._localId === localId ? { ...m, _status: "sent" } : m
              ),
            },
          };
        });
      } catch (e: any) {
        const errorStr = e?.toString() || "Unknown error";

        const isPermanent = /TxnTooBig|TxnTooLarge|MaxMessageLength/i.test(errorStr);

        setConversations((prev) => {
          if (!prev[conversationKey]) return prev;
          return {
            ...prev,
            [conversationKey]: {
              ...prev[conversationKey],
              messages: prev[conversationKey].messages.map((m: any) =>
                m._localId === localId ? { ...m, _status: "failed" } : m
              ),
            },
          };
        });

        if (isPermanent) {
          toast.error("Message too large to send.", {
            duration: Infinity,
            action: {
              label: "Delete",
              onClick: () => {
                removePendingMessage(appUser.PublicKeyBase58Check, localId);
                setConversations((prev) => {
                  if (!prev[conversationKey]) return prev;
                  return {
                    ...prev,
                    [conversationKey]: {
                      ...prev[conversationKey],
                      messages: prev[conversationKey].messages.filter(
                        (m: any) => m._localId !== localId
                      ),
                    },
                  };
                });
              },
            },
          });
        } else {
          toast.error(`Failed to send message: ${errorStr}`);
        }
      } finally {
        retryingIds.current.delete(localId);
      }
    },
    [appUser, sendNotify, usernameByPublicKeyBase58Check]
  );

  // Retry any pending messages from IndexedDB on startup (or user switch)
  const pendingRetryRanForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!appUser || loading) return;
    if (pendingRetryRanForUser.current === appUser.PublicKeyBase58Check) return;
    pendingRetryRanForUser.current = appUser.PublicKeyBase58Check;

    getPendingMessages(appUser.PublicKeyBase58Check).then((pendingMsgs) => {
      if (pendingMsgs.length === 0) return;
      toast.info(
        `Retrying ${pendingMsgs.length} unsent message${pendingMsgs.length > 1 ? "s" : ""}…`,
        {
          action: {
            label: "Clear all",
            onClick: () => {
              clearPendingMessages(appUser.PublicKeyBase58Check);
              // Remove all optimistic messages from every conversation
              setConversations((prev) => {
                const localIds = new Set(pendingMsgs.map((m) => m.localId));
                const next = { ...prev };
                for (const key of Object.keys(next)) {
                  const c = next[key];
                  const filtered = c.messages.filter((m: any) => !m._localId || !localIds.has(m._localId));
                  if (filtered.length !== c.messages.length) {
                    next[key] = { ...c, messages: filtered };
                  }
                }
                return next;
              });
              toast.success("Cleared all pending messages");
            },
          },
        }
      );
      for (const pending of pendingMsgs) {
        retryPendingMessage(pending);
      }
    });
  }, [appUser, loading, retryPendingMessage]);

  // Load hidden message IDs from IndexedDB on startup
  useEffect(() => {
    if (!appUser) return;
    getHiddenMessageIds(appUser.PublicKeyBase58Check).then(setHiddenMessageIds);
  }, [appUser]);

  // Reset account-scoped state and rehydrate when the user changes.
  // The clear MUST happen before rehydrate starts so stale data from
  // the previous account is gone before new data arrives.
  const prevRehydrateUserRef = useRef(appUser?.PublicKeyBase58Check);
  useEffect(() => {
    if (!appUser) return;

    const currentKey = appUser.PublicKeyBase58Check;
    const switched = prevRehydrateUserRef.current && prevRehydrateUserRef.current !== currentKey;
    prevRehydrateUserRef.current = currentKey;

    if (switched) {
      setConversations({});
      setUsernameByPublicKeyBase58Check({});
      setProfilePicByPublicKey({});
      setMembersByGroupKey({});
      setHiddenMessageIds(new Set());
      setPubKeyPlusGroupName("");
    }

    if (hasSetupMessaging(appUser)) {
      // New users who haven't completed onboarding see the wizard first.
      // Existing users are auto-graduated: anyone with cached data OR an
      // existing on-chain profile is clearly not a first-time user.
      if (!isOnboardingComplete(appUser.PublicKeyBase58Check)) {
        const isReturningUser =
          !!getCachedUserProfile(appUser.PublicKeyBase58Check) ||
          !!appUser.ProfileEntryResponse;
        if (isReturningUser) {
          markOnboardingComplete(appUser.PublicKeyBase58Check);
        } else {
          setShowOnboarding(true);
          setLoading(false);
          return;
        }
      }

      // If the app was opened from a push notification, navigate to that conversation
      const pending = useStore.getState().pendingConversationKey;
      if (pending) useStore.getState().setPendingConversationKey(null);

      // Check if the derived key needs upgrading (new association types, etc.).
      // Show a toast with a click action — must be user gesture to avoid popup blockers.
      if (needsPermissionUpgrade()) {
        toast("Update permissions to use new features", {
          duration: 15000,
          action: {
            label: "Update now",
            onClick: () => {
              requestFullPermissions().then((ok) => {
                if (ok) toast.success("Permissions updated!");
              });
            },
          },
        });
      }

      setLoading(true);
      setAutoFetchConversations(true);
      // If opened from a notification, always select the conversation even on mobile
      rehydrateConversation(pending || "", false, !isMobile || !!pending, isLoadingUser);
    } else {
      setLoading(false);
    }
  }, [appUser, isMobile]);

  // Handle push notification clicks from service worker
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "notification-click" && event.data.conversationKey) {
        setSelectedConversationPublicKey(event.data.conversationKey);
        clearUnread(event.data.conversationKey);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  // advanced-event-handler-refs: store handler in ref so the listener
  // doesn't re-register when handleWsNewMessage changes.
  const visibilityHandlerRef = useRef(handleWsNewMessage);
  visibilityHandlerRef.current = handleWsNewMessage;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // Refresh conversations + classification data when PWA resumes from background
  useEffect(() => {
    if (!appUser) return;
    const publicKey = appUser.PublicKeyBase58Check;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !loadingRef.current) {
        // Refresh conversations (existing behavior)
        visibilityHandlerRef.current("", "");

        // Silently re-fetch classification data (associations, follows) so
        // accept/block/dismiss actions from other devices sync without reload.
        Promise.all([
          fetchMutualFollows(publicKey),
          fetchChatAssociations(publicKey),
          fetchArchivedGroups(publicKey),
        ]).then(([mutual, assoc, archivedMap]) => {
          const approvedSet = new Set(assoc.approved.keys());
          const blockedSet = new Set(assoc.blocked.keys());
          const archivedSet = new Set(archivedMap.keys());
          const archivedChatsSet = new Set(assoc.archivedChats.keys());
          const dismissedSet = new Set(assoc.dismissed.keys());
          setClassificationData(
            mutual, approvedSet, blockedSet, assoc.approved, assoc.blocked,
            archivedSet, archivedMap, archivedChatsSet, assoc.archivedChats,
            dismissedSet, assoc.dismissed
          );
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [appUser]);

  useEffect(() => {
    setSelectedConversationPublicKey("");
    setLockRefresh(isLoadingUser);
    if (isLoadingUser && appUser) {
      setLoading(true);
    }
  }, [isLoadingUser, appUser]);

  useEffect(() => {
    if (conversations[selectedConversationPublicKey]) {
      const chatName = getChatNameFromConversation(
        conversations[selectedConversationPublicKey],
        usernameByPublicKeyBase58Check
      );

      if (chatName) {
        document.title = [chatName, BASE_TITLE].join(TITLE_DIVIDER);
      }
    }

    return () => {
      document.title = BASE_TITLE;
    };
  }, [
    selectedConversationPublicKey,
    conversations,
    usernameByPublicKeyBase58Check,
  ]);

  useInterval(
    async () => {
      const initConversationKey = selectedConversationPublicKey;

      if (
        !appUser ||
        !selectedConversationPublicKey ||
        lockRefreshRef.current ||
        pollingRef.current ||
        !navigator.onLine
      ) {
        return;
      }
      pollingRef.current = true;
      try {
        const { conversations, updatedAllAccessGroups } = await getConversations(
          appUser.PublicKeyBase58Check,
          allAccessGroups
        );
        setAllAccessGroups(updatedAllAccessGroups);
        const { updatedConversations, pubKeyPlusGroupName } =
          await getConversation(selectedConversationPublicKey, {
            ...conversations,
            [selectedConversationPublicKey]:
              conversations[selectedConversationPublicKey],
          });

        if (
          !lockRefreshRef.current &&
          conversations[selectedConversationPublicKey] &&
          initConversationKey === selectedConversationPublicKeyRef.current
        ) {
          const updatedMessages =
            updatedConversations[selectedConversationPublicKey]?.messages;
          if (updatedMessages) {
            mergeConversationUpdate(
              updatedConversations,
              selectedConversationPublicKey,
              updatedMessages
            );
          }
          setPubKeyPlusGroupName(pubKeyPlusGroupName);
        }
      } finally {
        pollingRef.current = false;
      }
    },
    isMobile
      ? REFRESH_MESSAGES_MOBILE_INTERVAL_MS
      : REFRESH_MESSAGES_INTERVAL_MS
  );

  const fetchUsersStateless = async (newPublicKeysToGet: Array<string>) => {
    const existingKeys = Object.keys(usernameByPublicKeyBase58Check);
    const diff = newPublicKeysToGet.filter((k) => !existingKeys.includes(k));

    if (diff.length === 0) {
      return Promise.resolve(usernameByPublicKeyBase58Check);
    }

    return getUsersStateless({
      PublicKeysBase58Check: Array.from(newPublicKeysToGet),
      SkipForLeaderboard: true,
    }).then((usersStatelessResponse) => {
      const newPublicKeyToUsernames: { [k: string]: string } = {};

      (usersStatelessResponse.UserList || []).forEach((u) => {
        newPublicKeyToUsernames[u.PublicKeyBase58Check] =
          u.ProfileEntryResponse?.Username || "";
      });

      setUsernameByPublicKeyBase58Check((state) => ({
        ...state,
        ...newPublicKeyToUsernames,
      }));
      return usernameByPublicKeyBase58Check;
    });
  };

  const fetchGroupMembers = async (conversation: Conversation) => {
    if (conversation.ChatType !== ChatType.GROUPCHAT) {
      return;
    }

    const { AccessGroupKeyName, OwnerPublicKeyBase58Check } =
      conversation.messages[0].RecipientInfo;

    // Fetch members and owner profile in parallel — the members API
    // doesn't include the group owner, so we fetch them separately.
    const [membersResult, ownerResult] = await Promise.all([
      getPaginatedAccessGroupMembers({
        AccessGroupOwnerPublicKeyBase58Check: OwnerPublicKeyBase58Check,
        AccessGroupKeyName,
        MaxMembersToFetch:
          MAX_MEMBERS_TO_REQUEST_IN_GROUP + MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN,
      }),
      getUsersStateless({
        PublicKeysBase58Check: [OwnerPublicKeyBase58Check],
        SkipForLeaderboard: true,
      }),
    ]);

    const { PublicKeyToProfileEntryResponse } = membersResult;

    // Merge the owner's profile into the members map
    const ownerProfile = ownerResult.UserList?.[0]?.ProfileEntryResponse;
    if (ownerProfile && !PublicKeyToProfileEntryResponse[OwnerPublicKeyBase58Check]) {
      PublicKeyToProfileEntryResponse[OwnerPublicKeyBase58Check] = ownerProfile;
    }

    setMembersByGroupKey((state) => ({
      ...state,
      [`${OwnerPublicKeyBase58Check}${AccessGroupKeyName}`]:
        PublicKeyToProfileEntryResponse,
    }));
    const usernamesByPublicKeyFromGroup: Record<string, string> = {};
    const groupProfilePics: Record<string, string> = {};
    Object.entries(PublicKeyToProfileEntryResponse || {}).forEach(([pk, profile]) => {
      usernamesByPublicKeyFromGroup[pk] = profile?.Username || "";
      const ed = profile?.ExtraData;
      if (ed) {
        const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
        if (picUrl) groupProfilePics[pk] = picUrl;
      }
    });
    setUsernameByPublicKeyBase58Check((state) => ({
      ...state,
      ...usernamesByPublicKeyFromGroup,
    }));
    setProfilePicByPublicKey((state) => ({
      ...state,
      ...groupProfilePics,
    }));

    return PublicKeyToProfileEntryResponse;
  };

  const rehydrateConversation = async (
    selectedKey = "",
    autoScroll = false,
    selectConversation = true,
    userChange = false
  ) => {
    if (!appUser) {
      toast.error("You must be logged in to use this feature");
      return;
    }

    const publicKey = appUser.PublicKeyBase58Check;

    // Mark user-initiated conversations (from search) so they go to Chats
    if (selectedKey) {
      addInitiatedChat(selectedKey.slice(0, PUBLIC_KEY_LENGTH));
    }

    // --- Cache-first: try to show cached data immediately ---
    const cachedConvos = await getCachedConversations(publicKey);
    const cachedClassification = getCachedClassificationData(publicKey);
    const cachedUsernames = getCachedUsernameMap(publicKey);
    const cachedLastKey = getCachedLastConversationKey(publicKey);

    // Load muted conversations from cache
    const cachedMuted = getCachedMutedConversations(publicKey);
    if (cachedMuted.size > 0) {
      useStore.getState().setMutedConversations(cachedMuted);
    }

    // Load privacy mode from cache
    const cachedPrivacy = getCachedPrivacyMode(publicKey);
    if (cachedPrivacy) {
      useStore.getState().setPrivacyMode(cachedPrivacy as "standard" | "full");
    }
    let renderedFromCache = false;

    if (cachedConvos && Object.keys(cachedConvos).length > 0) {
      // Hydrate classification from cache if not yet loaded
      if (cachedClassification && !chatRequestsLoaded) {
        setClassificationData(
          cachedClassification.mutualFollows,
          cachedClassification.approvedUsers,
          cachedClassification.blockedUsers,
          cachedClassification.approvedAssociationIds,
          cachedClassification.blockedAssociationIds,
          cachedClassification.archivedGroups,
          cachedClassification.archivedGroupAssociationIds,
          cachedClassification.archivedChats,
          cachedClassification.archivedChatAssociationIds,
          cachedClassification.dismissedUsers,
          cachedClassification.dismissedAssociationIds
        );
      }

      if (cachedUsernames) {
        setUsernameByPublicKeyBase58Check((state) => ({ ...state, ...cachedUsernames }));
      }

      const cachedKeyToUse =
        selectedKey ||
        (!userChange && selectedConversationPublicKey) ||
        cachedLastKey ||
        Object.keys(cachedConvos)[0];

      setConversations(cachedConvos);
      setLoading(false);
      setAutoFetchConversations(false);
      renderedFromCache = true;

      if (selectConversation && cachedKeyToUse) {
        setSelectedConversationPublicKey(cachedKeyToUse);
        setPubKeyPlusGroupName(cachedKeyToUse);
      }

      // Try to show cached messages for the selected conversation
      if (cachedKeyToUse && cachedConvos[cachedKeyToUse]) {
        const cachedMsgs = await getCachedConversationMessages(publicKey, cachedKeyToUse);
        if (cachedMsgs && cachedMsgs.length > 0) {
          setConversations((prev) => ({
            ...prev,
            [cachedKeyToUse]: {
              ...prev[cachedKeyToUse],
              messages: cachedMsgs as DecryptedMessageEntryResponse[],
            },
          }));
          setLoadingConversation(false);
        }
      }
    }

    // --- Background revalidation (or blocking if no cache) ---
    const conversationPromise = getConversations(publicKey, allAccessGroups);
    const classificationPromise = !chatRequestsLoaded
      ? Promise.all([
          fetchMutualFollows(publicKey),
          fetchChatAssociations(publicKey),
          fetchArchivedGroups(publicKey),
        ]).then(([mutual, assoc, archivedMap]) => {
          const approvedSet = new Set(assoc.approved.keys());
          const blockedSet = new Set(assoc.blocked.keys());
          const archivedSet = new Set(archivedMap.keys());
          const archivedChatsSet = new Set(assoc.archivedChats.keys());
          const dismissedSet = new Set(assoc.dismissed.keys());
          setClassificationData(
            mutual, approvedSet, blockedSet, assoc.approved, assoc.blocked,
            archivedSet, archivedMap, archivedChatsSet, assoc.archivedChats,
            dismissedSet, assoc.dismissed
          );
        }).catch((e) => {
          console.error("Failed to load chat request classification data:", e);
        })
      : Promise.resolve();

    // Fetch privacy mode from on-chain in parallel
    const privacyPromise = fetchPrivacyMode(publicKey)
      .then(({ mode, associationId }) => {
        useStore.getState().setPrivacyMode(mode, associationId);
      })
      .catch((e) => {
        console.error("Failed to fetch privacy mode:", e);
      });

    const [conversationResult] = await Promise.all([conversationPromise, classificationPromise, privacyPromise]);

    const {
      conversations: freshConversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    } = conversationResult;
    setAllAccessGroups(updatedAllAccessGroups);
    let conversationsResponse = freshConversations || {};
    const keyToUse =
      selectedKey ||
      (!userChange && selectedConversationPublicKey) ||
      Object.keys(conversationsResponse)[0];

    if (!conversationsResponse[keyToUse]) {
      conversationsResponse = {
        [keyToUse]: {
          ChatType: ChatType.DM,
          firstMessagePublicKey: keyToUse.slice(0, PUBLIC_KEY_LENGTH),
          messages: [],
        },
        ...conversationsResponse,
      };
    }

    const DMChats = Object.values(conversationsResponse).filter(
      (e) => e.ChatType === ChatType.DM
    );
    const GroupChats = Object.values(conversationsResponse).filter(
      (e) => e.ChatType === ChatType.GROUPCHAT
    );

    const publicKeyToUsername: { [k: string]: string } = {};
    const profilePicUrls: { [k: string]: string } = {};
    Object.entries(publicKeyToProfileEntryResponseMap).forEach(
      ([pk, profileEntryResponse]) => {
        publicKeyToUsername[pk] = profileEntryResponse?.Username || "";
        // Extract best profile pic URL from ExtraData (NFT/high-res take priority)
        const ed = profileEntryResponse?.ExtraData;
        if (ed) {
          const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
          if (picUrl) profilePicUrls[pk] = picUrl;
        }
      }
    );
    setUsernameByPublicKeyBase58Check((state) => ({
      ...state,
      ...publicKeyToUsername,
    }));
    setProfilePicByPublicKey((state) => ({
      ...state,
      ...profilePicUrls,
    }));
    await updateUsernameToPublicKeyMapFromConversations(DMChats);
    await Promise.all(GroupChats.map((e) => fetchGroupMembers(e)));

    // Cache the username map
    cacheUsernameMap(publicKey, { ...usernameByPublicKeyBase58Check, ...publicKeyToUsername });

    // Only force-select if user hasn't already navigated to a different conversation
    if (selectConversation && (!selectedConversationPublicKeyRef.current || selectedConversationPublicKeyRef.current === keyToUse)) {
      setSelectedConversationPublicKey(keyToUse);
    }

    if (!renderedFromCache) {
      setLoadingConversation(true);
    }

    try {
      const { updatedConversations, pubKeyPlusGroupName } =
        await getConversation(keyToUse, conversationsResponse);

      // Merge: start from prev state so we don't wipe full threads the user
      // loaded via the click handler while this rehydration was in-flight.
      setConversations((prev) => {
        const merged = { ...prev };
        const currentKey = selectedConversationPublicKeyRef.current;
        for (const [k, convo] of Object.entries(updatedConversations)) {
          if (!merged[k]) {
            merged[k] = convo;
          } else if (k === currentKey && k !== keyToUse) {
            // User is viewing a different conversation — preserve its full thread
            merged[k] = { ...convo, messages: merged[k].messages };
          } else {
            // For the rehydrated conversation and background conversations,
            // use fresh data but preserve optimistic messages
            const optimistic = merged[k].messages.filter((m: any) => m._localId && m._status !== "sent");
            merged[k] = convo;
            if (optimistic.length > 0) {
              merged[k] = { ...merged[k], messages: [...optimistic, ...merged[k].messages] };
            }
          }
        }
        // Remove conversations no longer returned by the blockchain
        // (e.g. user was removed from a group) — but keep the one the user is viewing
        for (const k of Object.keys(merged)) {
          if (!updatedConversations[k] && k !== currentKey) {
            delete merged[k];
          }
        }
        // Fire-and-forget cache writes
        cacheConversations(publicKey, merged);
        return merged;
      });
      // Only update pubKeyPlusGroupName if user is still on this conversation
      if (selectedConversationPublicKeyRef.current === keyToUse) {
        setPubKeyPlusGroupName(pubKeyPlusGroupName);
      }

      // Compute initial unread state from persisted last-read timestamps
      const lastReadTimestamps = getCachedLastReadTimestamps(publicKey);
      const { mutedConversations: muted, archivedGroups: archived } = useStore.getState();
      const unreadMap = new Map<string, number>();
      for (const [k, convo] of Object.entries(conversationsResponse)) {
        if (k === keyToUse) continue; // Currently selected conversation
        if (muted.has(k) || archived.has(k)) continue; // Skip muted/archived
        const latestMsg = convo.messages[0];
        if (!latestMsg || latestMsg.IsSender) continue; // No messages or I sent the latest
        const msgTs = latestMsg.MessageInfo.TimestampNanos;
        const lastRead = lastReadTimestamps[k];
        if (lastRead === undefined) {
          // First time seeing this conversation — seed as read
          cacheLastReadTimestamp(publicKey, k, msgTs);
        } else if (msgTs > lastRead) {
          unreadMap.set(k, 1);
        }
      }
      // Sync unread state to IndexedDB so the service worker has accurate counts
      syncUnreadConversations(Array.from(unreadMap.keys()));
      if (unreadMap.size > 0) {
        initializeUnread(unreadMap);
      } else {
        // No unread conversations — clear any stale PWA badge set by the service worker
        navigator.clearAppBadge?.();
      }
      // Mark the selected conversation as read
      if (keyToUse) {
        const selectedConvo = conversationsResponse[keyToUse];
        if (selectedConvo?.messages[0]) {
          cacheLastReadTimestamp(publicKey, keyToUse, selectedConvo.messages[0].MessageInfo.TimestampNanos);
        }
      }

      // Cache messages for the selected conversation
      if (updatedConversations[keyToUse]) {
        cacheConversationMessages(
          publicKey,
          keyToUse,
          updatedConversations[keyToUse].messages
        );
      }

      // Cache the last selected conversation (use the actual current selection
      // so a user navigation during rehydration is preserved on next launch)
      const finalKey = selectedConversationPublicKeyRef.current || keyToUse;
      if (finalKey) {
        cacheLastConversationKey(publicKey, finalKey);
      }
    } catch (e) {
      if (!renderedFromCache) {
        toast.error(`Error fetching current conversation: ${e}`);
        console.error(e);
      }
    } finally {
      // Only clear conversation loading if user hasn't navigated away —
      // their click handler owns the loading state in that case.
      if (!selectedConversationPublicKeyRef.current || selectedConversationPublicKeyRef.current === keyToUse) {
        setLoadingConversation(false);
      }
      setLoading(false);
    }

    setAutoFetchConversations(false);

    if (autoScroll) {
      scrollContainerToElement(".conversations-list", ".selected-conversation");
    }
  };

  const updateUsernameToPublicKeyMapFromConversations = async (
    DMChats: Conversation[]
  ) => {
    const newPublicKeysToGet = new Set<string>();
    DMChats.map((e) => {
      newPublicKeysToGet.add(e.firstMessagePublicKey);
      e.messages.forEach((m: NewMessageEntryResponse) => {
        newPublicKeysToGet.add(m.RecipientInfo.OwnerPublicKeyBase58Check);
        newPublicKeysToGet.add(m.SenderInfo.OwnerPublicKeyBase58Check);
      });
    });
    return await fetchUsersStateless(Array.from(newPublicKeysToGet));
  };

  // TODO: add support pagination
  const getConversation = async (
    pubKeyPlusGroupName: string,
    currentConversations = conversations
  ): Promise<{
    updatedConversations: ConversationMap;
    pubKeyPlusGroupName: string;
  }> => {
    if (!appUser) {
      toast.error("You must be logged in to use this feature");
      return { updatedConversations: {}, pubKeyPlusGroupName: "" };
    }

    const currentConvo = currentConversations[pubKeyPlusGroupName];
    if (!currentConvo) {
      return { updatedConversations: {}, pubKeyPlusGroupName: "" };
    }
    const convo = currentConvo.messages;

    if (currentConvo.ChatType === ChatType.DM) {
      const messages = await getPaginatedDMThread({
        UserGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
        UserGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        PartyGroupOwnerPublicKeyBase58Check: currentConvo.firstMessagePublicKey,
        PartyGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
        StartTimeStamp: new Date().valueOf() * 1e6,
      });

      const { decrypted, updatedAllAccessGroups } =
        await decryptAccessGroupMessagesWithRetry(
          appUser.PublicKeyBase58Check,
          messages.ThreadMessages,
          allAccessGroups
        );

      setAllAccessGroups(updatedAllAccessGroups);

      const updatedConversations = {
        ...currentConversations,
        ...{
          [pubKeyPlusGroupName]: {
            firstMessagePublicKey: decrypted.length
              ? decrypted[0].IsSender
                ? decrypted[0].RecipientInfo.OwnerPublicKeyBase58Check
                : decrypted[0].SenderInfo.OwnerPublicKeyBase58Check
              : currentConvo.firstMessagePublicKey,
            messages: decrypted,
            ChatType: ChatType.DM,
          },
        },
      };

      if (
        currentConvo &&
        currentConvo.firstMessagePublicKey &&
        usernameByPublicKeyBase58Check[currentConvo.firstMessagePublicKey] ===
          undefined
      ) {
        await fetchUsersStateless([currentConvo.firstMessagePublicKey]);
      }

      return {
        updatedConversations,
        pubKeyPlusGroupName,
      };
    } else {
      if (!convo) {
        return {
          updatedConversations: {},
          pubKeyPlusGroupName,
        };
      }
      const firstMessage = convo[0];
      const messages = await getPaginatedGroupChatThread({
        UserPublicKeyBase58Check:
          firstMessage.RecipientInfo.OwnerPublicKeyBase58Check,
        AccessGroupKeyName: firstMessage.RecipientInfo.AccessGroupKeyName,
        StartTimeStamp: firstMessage.MessageInfo.TimestampNanos * 10,
        MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
      });

      const { decrypted, updatedAllAccessGroups } =
        await decryptAccessGroupMessagesWithRetry(
          appUser.PublicKeyBase58Check,
          messages.GroupChatMessages,
          allAccessGroups
        );
      setAllAccessGroups(updatedAllAccessGroups);

      const updatedConversations = {
        ...currentConversations,
        ...{
          [pubKeyPlusGroupName]: {
            firstMessagePublicKey:
              firstMessage.RecipientInfo.OwnerPublicKeyBase58Check,
            messages: decrypted,
            ChatType: ChatType.GROUPCHAT,
          },
        },
      };

      return {
        updatedConversations,
        pubKeyPlusGroupName,
      };
    }
  };

  const getCurrentChatName = () => {
    if (!selectedConversation || !Object.keys(activeChatUsersMap).length) {
      return "";
    }

    const name = getChatNameFromConversation(
      selectedConversation,
      activeChatUsersMap
    );
    return (
      name ||
      shortenLongWord(
        selectedConversation.messages.length
          ? selectedConversation.messages[0].RecipientInfo
              .OwnerPublicKeyBase58Check
          : selectedConversation.firstMessagePublicKey
      ) ||
      ""
    );
  };

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    if (!appUser || !hasSetupMessaging(appUser)) return;

    const pending = useStore.getState().pendingConversationKey;
    if (pending) useStore.getState().setPendingConversationKey(null);

    setLoading(true);
    setAutoFetchConversations(true);
    rehydrateConversation(pending || "", false, !isMobile || !!pending);
  }, [appUser, isMobile, rehydrateConversation]);

  const conversationsReady = Object.keys(conversations).length > 0;
  const selectedConversation = conversations[selectedConversationPublicKey];
  const isGroupChat = selectedConversation?.ChatType === ChatType.GROUPCHAT;
  const isChatOwner =
    isGroupChat &&
    appUser &&
    selectedConversation?.messages[0]?.RecipientInfo
      ?.OwnerPublicKeyBase58Check === appUser.PublicKeyBase58Check;
  const isGroupOwner = isGroupChat && isChatOwner;
  const selectedGroupImageUrl = isGroupChat && selectedConversation?.messages[0]
    ? getGroupImageUrl(
        allAccessGroups,
        selectedConversation.messages[0].RecipientInfo.OwnerPublicKeyBase58Check,
        selectedConversation.messages[0].RecipientInfo.AccessGroupKeyName
      )
    : undefined;
  const chatMembers = membersByGroupKey[selectedConversationPublicKey];
  const activeChatUsersMap: { [k: string]: string } = isGroupChat
    ? Object.keys(chatMembers || {}).reduce<{ [k: string]: string }>(
        (acc, curr) => ({ ...acc, [curr]: chatMembers[curr]?.Username || "" }),
        {}
      )
    : usernameByPublicKeyBase58Check;

  // For group chats, notify ALL members (relay skips the sender).
  // For DMs, notify just the other participant.
  const notifyConversation = (convKey: string, dmRecipient: string, fromUsername?: string) => {
    const conv = conversations[convKey];
    const members = membersByGroupKey[convKey];
    if (conv?.ChatType === ChatType.GROUPCHAT && members) {
      const groupName = conv.messages[0]?.RecipientInfo?.AccessGroupKeyName;
      sendNotify(convKey, Object.keys(members), fromUsername, groupName);
    } else {
      sendNotify(convKey, [dmRecipient], fromUsername);
    }
  };
  return (
    <div className="h-full">      
      {/* Onboarding wizard for new users */}
      {showOnboarding && appUser && hasSetupMessaging(appUser) && !isLoadingUser && (
        <div className="h-full overflow-y-auto">
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        </div>
      )}

      {/* Loading / setup states (non-onboarding) */}
      {!showOnboarding && (!conversationsReady ||
        !hasSetupMessaging(appUser) ||
        isLoadingUser ||
        loading) && (
        <div className="m-auto relative top-8 overflow-hidden pt-[30px] pb-[50px]">
          <div className="bg-gradient"></div>
          <div className="w-full lg:max-w-[1200px] m-auto bg-transparent p-0 shadow-none">
            <div>
              {(autoFetchConversations || isLoadingUser || loading) && (
                <div className="text-center">
                  <Loader2 className="w-11 h-11 mt-4 animate-spin text-[#34F080] mx-auto" />
                </div>
              )}
              {!autoFetchConversations &&
                !hasSetupMessaging(appUser) &&
                !isLoadingUser &&
                !loading && (
                  <div className="text-left flex flex-col lg:flex-row items-center justify-between">
                    <div className="w-full lg:w-[50%]">
                      <div>
                        {appUser ? (
                          <div>
                            <h2 className="text-2xl font-bold mb-3 text-white">
                              Set up your account
                            </h2>
                            <p className="text-lg mb-6 text-gray-400">
                              It seems like your account needs more configuration
                              to be able to send messages. Press the button below
                              to set it up automatically
                            </p>
                          </div>
                        ) : (
                          <div className="text-left w-full md:max-w-[100%]">
                            <h2 className="text-3xl lg:text-3xl font-semibold mb-6 text-white">
                              Chat with anyone, on DeSo or Ethereum. Without the risk of being censored.
                            </h2>
                            <p className="text-sm mb-5 text-gray-400">
                              DeSo Chat Protocol is a censorship-resistant messaging
                              protocol built on top of the DeSo blockchain. It enables fully decentralized cross-chain
                              messaging between DeSo and Ethereum wallets (and soon, Solana).
                            </p>
                            <p className="text-sm mb-5 text-gray-400">
                              This is possible due to DeSo's infinite-state blockchain & derived keys cryptography.
                            </p>
                            <p className="text-sm mb-5 text-gray-400">
                              Messages are stored directly on-chain, at an average cost of ~$0.000002 (<em>basically free</em>), with end-to-end encryption, and support for DMs & group chats — including fully on-chain social, identity, creator coins, tokens & NFTs.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6 text-[#34F080]">
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> E2EE messages & group chats</div>
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> 100% on-chain (fully synced)</div>
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Sign in with DeSo & MetaMask</div>
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Message DeSo & Ethereum wallets</div>
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Open-source & built on DeSo</div>
                          <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/> On-chain social, identity & assets</div>
                      </div>
                      <MessagingSetupButton />
                      <p className="mt-5 text-sm mb-5 text-blue-300/40">
                        This project is fully open-sourced for developers to fork & build on top of.
                        You can add features like ENS support, NFT profile pictures, message tipping, paid DMs, token-gated group chats and more.
                        Visit&nbsp;
                        <a
                          target="_blank"
                          className="underline text-blue-300/40 hover:text-blue-300"
                          href="https://github.com/sungkhum/chaton"
                          rel="noreferrer"
                        >
                          Github Repository &rarr;
                        </a> or&nbsp;
                        <a
                          target="_blank"
                          className="underline text-blue-300/40 hover:text-blue-300"
                          href="https://github.com/sungkhum/chaton"
                          rel="noreferrer"
                        >
                          Developer Docs &rarr;
                        </a>
                      </p>
                    </div>
                  </div>
                )}

              {!autoFetchConversations &&
                hasSetupMessaging(appUser) &&
                !isLoadingUser &&
                !loading && (
                  <MessagingConversationButton
                    onClick={rehydrateConversation}
                  />
                )}
            </div>
          </div>
        </div>
      )}
      {!showOnboarding &&
        hasSetupMessaging(appUser) &&
        conversationsReady &&
        appUser &&
        !isLoadingUser &&
        !loading && (
          <div className="flex h-full">
            <div className="w-full md:w-[340px] border-r border-white/5 bg-[#080d16] shrink-0">
              <MessagingConversationAccount
                rehydrateConversation={rehydrateConversation}
                onClick={async (key: string) => {
                  if (key === selectedConversationPublicKey) {
                    // Still clear unread badge if a message arrived while viewing
                    if (unreadByConversation.has(key)) {
                      clearUnread(key);
                      removeUnreadConversation(key);
                      sendRead(key);
                      if (appUser && conversations[key]?.messages[0]) {
                        cacheLastReadTimestamp(
                          appUser.PublicKeyBase58Check,
                          key,
                          conversations[key].messages[0].MessageInfo.TimestampNanos
                        );
                      }
                    }
                    return;
                  }
                  setSelectedConversationPublicKey(key);
                  setPubKeyPlusGroupName(key);
                  setLoadingConversation(true);
                  setEditingMessage(null);
                  setReplyToMessage(null);
                  clearUnread(key);
                  removeUnreadConversation(key);
                  sendRead(key);

                  // Persist last-read timestamp for this conversation
                  if (appUser && conversations[key]?.messages[0]) {
                    cacheLastReadTimestamp(
                      appUser.PublicKeyBase58Check,
                      key,
                      conversations[key].messages[0].MessageInfo.TimestampNanos
                    );
                  }

                  // Cache the last selected conversation
                  if (appUser) {
                    cacheLastConversationKey(appUser.PublicKeyBase58Check, key);
                  }

                  setLockRefresh(true);

                  // Try cache-first for messages
                  if (appUser) {
                    const cached = await getCachedConversationMessages(
                      appUser.PublicKeyBase58Check,
                      key
                    );
                    if (cached && cached.length > 0 && key === selectedConversationPublicKeyRef.current) {
                      setConversations((prev) => ({
                        ...prev,
                        [key]: {
                          ...prev[key],
                          messages: cached as DecryptedMessageEntryResponse[],
                        },
                      }));
                      setLoadingConversation(false);
                    }
                  }

                  try {
                    const { updatedConversations, pubKeyPlusGroupName } =
                      await getConversation(key);
                    // Only apply if this conversation is still selected
                    // (prevents stale fetch from overwriting after rapid clicks)
                    if (key === selectedConversationPublicKeyRef.current) {
                      setConversations((prev) => ({
                        ...prev,
                        [key]: updatedConversations[key],
                      }));
                      setPubKeyPlusGroupName(pubKeyPlusGroupName);

                      // Cache the fetched messages
                      if (appUser && updatedConversations[key]) {
                        cacheConversationMessages(
                          appUser.PublicKeyBase58Check,
                          key,
                          updatedConversations[key].messages
                        );
                      }
                    }
                  } finally {
                    // Only unlock if still on this conversation to avoid
                    // releasing the lock for a subsequent click's fetch
                    if (key === selectedConversationPublicKeyRef.current) {
                      setLoadingConversation(false);
                      setLockRefresh(false);
                    }
                  }
                }}
                conversations={chatConversations}
                requestConversations={requestConversations}
                archivedConversations={archivedConversations}
                onAccept={handleAcceptRequest}
                onBlock={handleBlockRequest}
                onDismiss={handleDismissRequest}
                onUnarchive={handleUnarchiveGroup}
                onUnarchiveChat={handleUnarchiveChat}
                onUnblock={handleUnblock}
                onUndismiss={handleUndismiss}
                blockedUsers={blockedUsers}
                dismissedUsers={dismissedUsers}
                getUsernameByPublicKeyBase58Check={
                  usernameByPublicKeyBase58Check
                }
                selectedConversationPublicKey={selectedConversationPublicKey}
                unreadByConversation={unreadByConversation}
                mutedConversations={mutedConversations}
                searchQuery={searchQuery}
                searchResults={searchResults}
                isSearching={isMessageSearching}
                isDeepSearching={isDeepSearching}
                searchProgress={searchProgress}
                onSearchQueryChange={setSearchQuery}
                onSearchResultClick={handleSearchResultClick}
                searchClearTrigger={searchClearTrigger}
              />
            </div>

            <div
              className={`w-full h-full shrink-0 md:flex-1 md:min-w-0 bg-[#0a1019] md:ml-0 md:z-auto ${
                selectedConversationPublicKey ? "ml-[-100%] z-50" : ""
              }`}
            >
              <header
                className="flex justify-between items-center border-b border-white/5 relative px-4 md:px-5 h-14"
              >
                <div
                  className="cursor-pointer py-4 pl-0 pr-6 md:hidden"
                  onClick={() => {
                    setSelectedConversationPublicKey("");
                    setEditingMessage(null);
                    setReplyToMessage(null);
                  }}
                >
                  <img src="/assets/left-chevron.png" width={20} alt="back" />
                </div>
                {selectedConversation &&
                  (selectedConversation.messages[0] ||
                    (!isGroupChat &&
                      selectedConversation.firstMessagePublicKey)) && (
                    <div className="flex items-center gap-2 min-w-0 px-2 md:hidden">
                      {isGroupChat && selectedGroupImageUrl && (
                        <MessagingDisplayAvatar
                          publicKey={getCurrentChatName()}
                          groupChat
                          groupImageUrl={selectedGroupImageUrl}
                          diameter={32}
                        />
                      )}
                      <span className="text-white font-bold text-base truncate">
                        {getCurrentChatName()}
                      </span>
                    </div>
                  )}
                <div
                  className={`text-gray-400 items-center hidden ${
                    isGroupOwner ? "md:block" : "md:hidden"
                  }`}
                >
                  You're the<strong> owner of this group</strong>
                </div>
                <div
                  className={`flex items-center gap-3 justify-end shrink-0 ${
                    !isGroupOwner ? "md:w-full md:shrink" : ""
                  }`}
                >
                  {selectedConversationPublicKey && (
                    <button
                      onClick={() => {
                        toggleMute(selectedConversationPublicKey);
                        const wasMuted = mutedConversations.has(selectedConversationPublicKey);
                        toast(wasMuted ? "Notifications unmuted" : "Notifications muted", {
                          icon: wasMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />,
                          duration: 2000,
                        });
                      }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                      title={mutedConversations.has(selectedConversationPublicKey) ? "Unmute notifications" : "Mute notifications"}
                    >
                      {mutedConversations.has(selectedConversationPublicKey) ? (
                        <BellOff className="w-5 h-5 text-gray-500" />
                      ) : (
                        <Bell className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  {isGroupChat ? (
                    <ManageMembersDialog
                      conversation={selectedConversation}
                      conversationKey={selectedConversationPublicKey}
                      onSuccess={rehydrateConversation}
                      onLeaveGroup={handleArchiveGroup}
                      isGroupOwner={!!isGroupOwner}
                    />
                  ) : (
                    selectedConversation &&
                    selectedConversation.firstMessagePublicKey && (
                      <>
                        <button
                          onClick={() => {
                            handleArchiveChat(
                              selectedConversationPublicKey,
                              selectedConversation.firstMessagePublicKey
                            );
                          }}
                          className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                          title="Archive chat"
                        >
                          <Archive className="w-5 h-5 text-gray-400" />
                        </button>
                        {/* Three-dot menu for DM actions (block, etc.) */}
                        <div className="relative">
                          <button
                            onClick={() => setDmMenuOpen(!dmMenuOpen)}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                            title="More options"
                          >
                            <EllipsisVertical className="w-5 h-5 text-gray-400" />
                          </button>
                          {dmMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setDmMenuOpen(false)} />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-[#141c2b] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]">
                                <button
                                  onClick={() => {
                                    setDmMenuOpen(false);
                                    setBlockConfirm({
                                      conversationKey: selectedConversationPublicKey,
                                      publicKey: selectedConversation.firstMessagePublicKey,
                                      name: activeChatUsersMap[selectedConversation.firstMessagePublicKey] || "this user",
                                    });
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                  <ShieldBan className="w-4 h-4" />
                                  Block user
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <MessagingDisplayAvatar
                          username={
                            activeChatUsersMap[
                              selectedConversation.firstMessagePublicKey
                            ]
                          }
                          publicKey={selectedConversation.firstMessagePublicKey}
                          diameter={40}
                          classNames="shrink-0"
                        />
                      </>
                    )
                  )}
                </div>
              </header>

              <div
                className="pr-2 rounded-none w-[100%] bg-transparent ml-[calc-340px] pb-0 h-[calc(100%-56px)]"
              >
                <div className="border-none flex flex-col h-full">
                  <div className="overflow-hidden flex-1 min-h-0">
                    {loadingConversation ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-11 h-11 animate-spin text-[#34F080]" />
                      </div>
                    ) : (
                      <MessagingBubblesAndAvatar
                        key={selectedConversationPublicKey}
                        conversationPublicKey={selectedConversationPublicKey}
                        conversations={conversations}
                        getUsernameByPublicKey={activeChatUsersMap}
                        profilePicByPublicKey={profilePicByPublicKey}
                        onScroll={(e: Array<DecryptedMessageEntryResponse>) => {
                          setConversations((prev) => ({
                            ...prev,
                            [selectedConversationPublicKey]: {
                              ...prev[selectedConversationPublicKey],
                              messages: [
                                ...prev[selectedConversationPublicKey].messages,
                                ...e,
                              ],
                            },
                          }));
                        }}
                        onReply={(msg) => {
                          setEditingMessage(null);
                          setReplyToMessage({
                            text: msg.DecryptedMessage || "",
                            timestamp: msg.MessageInfo.TimestampNanosString,
                          });
                        }}
                        hiddenMessageIds={hiddenMessageIds}
                        onEdit={(msg) => {
                          setReplyToMessage(null);
                          setEditingMessage({
                            text: msg.DecryptedMessage || "",
                            timestamp: msg.MessageInfo.TimestampNanosString,
                          });
                        }}
                        onDeleteForMe={async (timestampNanosString) => {
                          if (!appUser) return;
                          setHiddenMessageIds((prev) => {
                            const next = new Set(prev);
                            next.add(timestampNanosString);
                            return next;
                          });
                          await hideMessage(appUser.PublicKeyBase58Check, timestampNanosString);
                        }}
                        onDeleteForEveryone={async (message) => {
                          if (!appUser) return;
                          const convKey = selectedConversationPublicKey;
                          const recipientPublicKey =
                            selectedConversation.ChatType === ChatType.DM
                              ? selectedConversation.firstMessagePublicKey
                              : selectedConversation.messages[0].RecipientInfo
                                  .OwnerPublicKeyBase58Check;
                          const recipientKeyName =
                            selectedConversation.ChatType === ChatType.DM
                              ? DEFAULT_KEY_MESSAGING_GROUP_NAME
                              : selectedConversation.messages[0].RecipientInfo
                                  .AccessGroupKeyName;
                          const timestampNanosString = message.MessageInfo.TimestampNanosString;

                          // Save original for rollback
                          const originalMessage = message;

                          // Preserve existing ExtraData and add deleted flag
                          const existingExtraData = message.MessageInfo?.ExtraData || {};
                          const deletedExtraData = { ...existingExtraData, "msg:deleted": "true" };

                          // Optimistic: replace message with tombstone
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.map((m) =>
                                m.MessageInfo.TimestampNanosString === timestampNanosString
                                  ? {
                                      ...m,
                                      DecryptedMessage: "",
                                      MessageInfo: {
                                        ...m.MessageInfo,
                                        ExtraData: deletedExtraData,
                                      },
                                    }
                                  : m
                              ),
                            },
                          }));
                          setLockRefresh(true);

                          try {
                            await encryptAndUpdateMessage(
                              "[deleted]",
                              appUser.PublicKeyBase58Check,
                              recipientPublicKey,
                              recipientKeyName,
                              DEFAULT_KEY_MESSAGING_GROUP_NAME,
                              timestampNanosString,
                              deletedExtraData
                            );
                            notifyConversation(convKey, recipientPublicKey);
                          } catch (e) {
                            toast.error("Failed to delete message for everyone");
                            // Rollback
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m) =>
                                  m.MessageInfo.TimestampNanosString === timestampNanosString
                                    ? originalMessage
                                    : m
                                ),
                              },
                            }));
                          } finally {
                            setLockRefresh(false);
                          }
                        }}
                        onRetry={async (localId) => {
                          if (!appUser) return;
                          const pendingMsgs = await getPendingMessages(appUser.PublicKeyBase58Check);
                          const pending = pendingMsgs.find((m) => m.localId === localId);
                          if (pending) {
                            retryPendingMessage(pending);
                          }
                        }}
                        onDeleteFailed={(localId) => {
                          if (!appUser) return;
                          const convKey = selectedConversationPublicKey;
                          // Remove the failed optimistic message from UI
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.filter(
                                (m: any) => m._localId !== localId
                              ),
                            },
                          }));
                          // Remove from pending messages storage
                          removePendingMessage(appUser.PublicKeyBase58Check, localId);
                        }}
                        onReact={async (timestampNanosString, emoji) => {
                          if (!appUser) return;
                          const recipientPublicKey =
                            selectedConversation.ChatType === ChatType.DM
                              ? selectedConversation.firstMessagePublicKey
                              : selectedConversation.messages[0].RecipientInfo
                                  .OwnerPublicKeyBase58Check;
                          const recipientKeyName =
                            selectedConversation.ChatType === ChatType.DM
                              ? DEFAULT_KEY_MESSAGING_GROUP_NAME
                              : selectedConversation.messages[0].RecipientInfo
                                  .AccessGroupKeyName;

                          // Build a human-readable fallback for apps without reaction support
                          const reactedToMsg = selectedConversation.messages.find(
                            (m) => m.MessageInfo.TimestampNanosString === timestampNanosString
                          );
                          const preview = reactedToMsg?.DecryptedMessage?.slice(0, 30) || "";
                          const fallbackText = preview
                            ? `Reacted ${emoji} to "${preview}${(reactedToMsg?.DecryptedMessage?.length ?? 0) > 30 ? "…" : ""}"`
                            : `Reacted ${emoji}`;

                          // Optimistic: insert a mock reaction message immediately
                          const convKey = selectedConversationPublicKey;
                          const localId = `local-reaction-${Date.now()}-${Math.random()}`;
                          const TimestampNanos = new Date().getTime() * 1e6;
                          const mockReaction = {
                            DecryptedMessage: fallbackText,
                            IsSender: true,
                            _status: "sending" as const,
                            _localId: localId,
                            SenderInfo: {
                              OwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
                              AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
                            },
                            RecipientInfo: {
                              OwnerPublicKeyBase58Check: recipientPublicKey,
                              AccessGroupKeyName: recipientKeyName,
                            },
                            MessageInfo: {
                              TimestampNanos,
                              TimestampNanosString: String(TimestampNanos),
                              ExtraData: buildExtraData({
                                type: "reaction",
                                replyTo: timestampNanosString,
                                emoji,
                              }),
                            },
                          } as DecryptedMessageEntryResponse & { _status: string; _localId: string };

                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: [mockReaction, ...prev[convKey].messages],
                            },
                          }));

                          try {
                            await encryptAndSendNewMessage(
                              fallbackText,
                              appUser.PublicKeyBase58Check,
                              recipientPublicKey,
                              recipientKeyName,
                              DEFAULT_KEY_MESSAGING_GROUP_NAME,
                              buildExtraData({
                                type: "reaction",
                                replyTo: timestampNanosString,
                                emoji,
                              })
                            );
                            // Notify via WebSocket relay
                            notifyConversation(convKey, recipientPublicKey);
                            // Mark as sent
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m: any) =>
                                  m._localId === localId ? { ...m, _status: "sent" } : m
                                ),
                              },
                            }));
                          } catch (e) {
                            // Remove failed optimistic reaction
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.filter(
                                  (m: any) => m._localId !== localId
                                ),
                              },
                            }));
                            toast.error("Failed to send reaction");
                          }
                        }}
                      />
                    )}
                  </div>

                  <SendMessageButtonAndInput
                    key={selectedConversationPublicKey}
                    conversationKey={selectedConversationPublicKey}
                    replyTo={replyToMessage}
                    onCancelReply={() => setReplyToMessage(null)}
                    editingMessage={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                    onSubmitEdit={async (newText, timestamp) => {
                      if (!appUser || !newText.trim()) return;
                      setEditingMessage(null);
                      const convKey = selectedConversationPublicKey;
                      const recipientPublicKey =
                        selectedConversation.ChatType === ChatType.DM
                          ? selectedConversation.firstMessagePublicKey
                          : selectedConversation.messages[0].RecipientInfo
                              .OwnerPublicKeyBase58Check;
                      const recipientKeyName =
                        selectedConversation.ChatType === ChatType.DM
                          ? DEFAULT_KEY_MESSAGING_GROUP_NAME
                          : selectedConversation.messages[0].RecipientInfo
                              .AccessGroupKeyName;

                      // Find original message for rollback
                      const originalMessage = selectedConversation.messages.find(
                        (m) => m.MessageInfo.TimestampNanosString === timestamp
                      );

                      // Preserve existing ExtraData (e.g. reply info) and add edited flag
                      const existingExtraData = originalMessage?.MessageInfo?.ExtraData || {};
                      const updatedExtraData = { ...existingExtraData, "msg:edited": "true" };

                      // Optimistic: update message text and add edited flag
                      setConversations((prev) => ({
                        ...prev,
                        [convKey]: {
                          ...prev[convKey],
                          messages: prev[convKey].messages.map((m) =>
                            m.MessageInfo.TimestampNanosString === timestamp
                              ? {
                                  ...m,
                                  DecryptedMessage: newText,
                                  MessageInfo: {
                                    ...m.MessageInfo,
                                    ExtraData: updatedExtraData,
                                  },
                                }
                              : m
                          ),
                        },
                      }));
                      setLockRefresh(true);

                      try {
                        await encryptAndUpdateMessage(
                          newText,
                          appUser.PublicKeyBase58Check,
                          recipientPublicKey,
                          recipientKeyName,
                          DEFAULT_KEY_MESSAGING_GROUP_NAME,
                          timestamp,
                          updatedExtraData
                        );
                        notifyConversation(convKey, recipientPublicKey);
                      } catch (e) {
                        toast.error("Failed to edit message");
                        // Rollback
                        if (originalMessage) {
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.map((m) =>
                                m.MessageInfo.TimestampNanosString === timestamp
                                  ? originalMessage
                                  : m
                              ),
                            },
                          }));
                        }
                      } finally {
                        setLockRefresh(false);
                      }
                    }}
                    onKeystroke={() => onKeystroke(selectedConversationPublicKey)}
                    typingUsers={getTypingUsersForConversation(selectedConversationPublicKey)
                      .map((pk) => usernameByPublicKeyBase58Check[pk] || shortenLongWord(pk))
                      .filter(Boolean)}
                    mentionCandidates={isGroupChat && chatMembers
                      ? Object.entries(chatMembers)
                          .filter(([pk, profile]) =>
                            pk !== appUser?.PublicKeyBase58Check && profile?.Username
                          )
                          .map(([pk, profile]) => ({
                            publicKey: pk,
                            username: profile!.Username,
                          }))
                      : undefined}
                    onClick={async (messageToSend: string, extraData?: Record<string, string>) => {
                      // Merge reply data into extraData if replying
                      if (replyToMessage) {
                        extraData = {
                          ...extraData,
                          [MSG_REPLY_TO]: replyToMessage.timestamp,
                          [MSG_REPLY_PREVIEW]: replyToMessage.text.slice(0, 100),
                        };
                        setReplyToMessage(null);
                      }
                      // Generate a mock message to display in the UI to give
                      // the user immediate feedback.
                      const TimestampNanos = new Date().getTime() * 1e6;
                      const recipientPublicKey =
                        selectedConversation.ChatType === ChatType.DM
                          ? selectedConversation.firstMessagePublicKey
                          : selectedConversation.messages[0].RecipientInfo
                              .OwnerPublicKeyBase58Check;
                      const recipientAccessGroupKeyName =
                        selectedConversation.ChatType === ChatType.DM
                          ? DEFAULT_KEY_MESSAGING_GROUP_NAME
                          : selectedConversation.messages[0].RecipientInfo
                              .AccessGroupKeyName;
                      const localId = `local-${Date.now()}-${Math.random()}`;
                      const mockMessage = {
                        DecryptedMessage: messageToSend,
                        IsSender: true,
                        _status: "sending" as const,
                        _localId: localId,
                        SenderInfo: {
                          OwnerPublicKeyBase58Check:
                            appUser.PublicKeyBase58Check,
                          AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
                        },
                        RecipientInfo: {
                          OwnerPublicKeyBase58Check: recipientPublicKey,
                          AccessGroupKeyName: recipientAccessGroupKeyName,
                        },
                        MessageInfo: {
                          TimestampNanos,
                          TimestampNanosString: String(TimestampNanos),
                          ExtraData: extraData || {},
                        },
                      } as DecryptedMessageEntryResponse & { _status: string; _localId: string };

                      // Optimistic: insert immediately with "sending" status
                      const convKey = selectedConversationPublicKey;
                      setConversations((prev) => ({
                        ...prev,
                        [convKey]: {
                          ...prev[convKey],
                          messages: [mockMessage, ...prev[convKey].messages],
                        },
                      }));
                      setLockRefresh(true);

                      // Persist to IndexedDB so the message survives app close.
                      // Awaited so the write lands before the blockchain call starts.
                      const pending: PendingMessage = {
                        localId,
                        conversationKey: convKey,
                        messageText: messageToSend,
                        senderPublicKey: appUser.PublicKeyBase58Check,
                        recipientPublicKey,
                        recipientAccessGroupKeyName,
                        extraData,
                        createdAt: Date.now(),
                      };
                      await addPendingMessage(pending);

                      try {
                        await encryptAndSendNewMessage(
                          messageToSend,
                          appUser.PublicKeyBase58Check,
                          recipientPublicKey,
                          recipientAccessGroupKeyName,
                          DEFAULT_KEY_MESSAGING_GROUP_NAME,
                          extraData
                        );
                        // Sent successfully — remove from IndexedDB
                        removePendingMessage(appUser.PublicKeyBase58Check, localId);
                        // Notify via WebSocket relay
                        notifyConversation(
                          convKey,
                          recipientPublicKey,
                          usernameByPublicKeyBase58Check[appUser.PublicKeyBase58Check] || appUser.PublicKeyBase58Check
                        );
                        // Update status to "sent" (blockchain accepted)
                        setConversations((prev) => ({
                          ...prev,
                          [convKey]: {
                            ...prev[convKey],
                            messages: prev[convKey].messages.map((m: any) =>
                              m._localId === localId ? { ...m, _status: "sent" } : m
                            ),
                          },
                        }));
                      } catch (e: any) {
                        // Update status to "failed" — pending message stays in IndexedDB for retry
                        setConversations((prev) => ({
                          ...prev,
                          [convKey]: {
                            ...prev[convKey],
                            messages: prev[convKey].messages.map((m: any) =>
                              m._localId === localId ? { ...m, _status: "failed" } : m
                            ),
                          },
                        }));
                        toast.error(
                          `An error occurred while sending your message. Error: ${e.toString()}`
                        );
                        return Promise.reject(e);
                      } finally {
                        setLockRefresh(false);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Block confirmation dialog */}
      {blockConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setBlockConfirm(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141c2b] border border-white/10 rounded-xl shadow-2xl p-6 w-[320px] max-w-[90vw]">
            <h3 className="text-white font-bold text-base mb-2">Block {blockConfirm.name}?</h3>
            <p className="text-gray-400 text-sm mb-5">
              They won't be able to message you. You can unblock them later from the Requests tab.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBlockConfirm(null)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleBlockRequest(blockConfirm.conversationKey, blockConfirm.publicKey);
                  setBlockConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/30 cursor-pointer transition-colors"
              >
                Block
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


