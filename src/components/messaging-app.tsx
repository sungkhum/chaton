import {
  Loader2,
  CheckCircle,
  Bell,
  BellOff,
  Archive,
  EllipsisVertical,
  ShieldBan,
} from "lucide-react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedAccessGroupMembers,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  getUsersStateless,
  NewMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  sendDeso,
  identity,
  transferDeSoToken,
} from "deso-protocol";
import { useInterval } from "hooks/useInterval";
import { useIdleDetection } from "hooks/useIdleDetection";
import {
  FC,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  startTransition,
} from "react";
import { toast } from "sonner";
import { useMessageSearch } from "../hooks/useMessageSearch";
import { useMobile } from "../hooks/useMobile";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useTypingIndicator,
  useTypingDisplay,
} from "../hooks/useTypingIndicator";
import { usePresence } from "../hooks/usePresence";
import {
  needsPermissionUpgrade,
  requestFullPermissions,
} from "../utils/with-auth";
import {
  classifyConversation,
  createApprovalAssociation,
  createArchiveChatAssociation,
  createArchiveAssociation,
  createBlockAssociation,
  createDismissAssociation,
  buildShellConversations,
  decryptAccessGroupMessagesWithRetry,
  decryptConversationPreviews,
  cleanupOwnJoinRequests,
  deleteArchiveAssociation,
  deleteAssociationById,
  encryptAndSendNewMessage,
  encryptAndUpdateMessage,
  fetchArchivedGroups,
  fetchAssociationsByType,
  fetchChatAssociations,
  fetchJoinRequestCountsForOwner,
  fetchMessageThreadsRaw,
  fetchFollowedUsers,
  fetchPrivacyMode,
  getConversations,
  getConversationsDifferential,
  sendSystemMessage,
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
  mergeReadCursors,
  consumePendingNotificationConversation,
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
  FOREGROUND_RESUME_DEBOUNCE_MS,
  REFRESH_MESSAGES_INTERVAL_MS,
  REFRESH_MESSAGES_MAX_INTERVAL_MS,
  REFRESH_MESSAGES_MOBILE_INTERVAL_MS,
  REFRESH_MESSAGES_WS_CONNECTED_MS,
  TITLE_DIVIDER,
} from "../utils/constants";
import {
  formatLastSeen,
  getChatNameFromConversation,
  hasSetupMessaging,
  scrollContainerToElement,
} from "../utils/helpers";
import { Conversation, ConversationMap } from "../utils/types";
import {
  buildExtraData,
  getGroupDisplayName,
  getGroupImageUrl,
  parseMessageType,
  MSG_REPLY_TO,
  MSG_REPLY_PREVIEW,
  MSG_REPLY_SENDER,
  type MentionEntry,
} from "../utils/extra-data";
const LazyTipConfirmDialog = lazy(() =>
  import("./tip-confirm-dialog").then((m) => ({ default: m.TipConfirmDialog }))
);
import { withAuth } from "../utils/with-auth";
import { fetchExchangeRate, usdToNanos } from "../utils/exchange-rate";
import {
  fetchUsdcBalance,
  usdToUsdcBaseUnits,
  toHexUint256,
  invalidateUsdcBalanceCache,
} from "../utils/usdc-balance";
import { USDC_CREATOR_PUBLIC_KEY } from "../utils/constants";
import { getCachedTipCurrency } from "../services/cache.service";
import type { TipCurrency } from "../utils/extra-data";

// Micro-tip cooldown (3 seconds between tips)
let lastMicroTipTime = 0;
const MICRO_TIP_COOLDOWN_MS = 3000;
import { JoinGroupModal } from "./join-group-modal";
const LazyJoinConfirmationModal = lazy(() =>
  import("./join-confirmation-modal").then((m) => ({
    default: m.JoinConfirmationModal,
  }))
);
const LazyManageMembersDialog = lazy(() =>
  import("./manage-members-dialog").then((m) => ({
    default: m.ManageMembersDialog,
  }))
);
import { MessagingBubblesAndAvatar } from "./messaging-bubbles";
import { MessagingConversationAccount } from "./messaging-conversation-accounts";
import { MessagingConversationButton } from "./messaging-conversation-button";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessagingSetupButton } from "./messaging-setup-button";
import { OnboardingWizard } from "./onboarding/onboarding-wizard";
import {
  isOnboardingComplete,
  markOnboardingComplete,
} from "../utils/onboarding";
import { shortenLongWord } from "../utils/search-helpers";
import {
  SendMessageButtonAndInput,
  SendMessageInputHandle,
} from "./send-message-button-and-input";
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

/**
 * Find the timestamp of the latest message NOT sent by the current user.
 * In group chats the user might have sent the latest message (or a reaction)
 * while there are still unread messages from others above it.
 * Returns 0 if no incoming message is found.
 */
function latestIncomingTimestamp(convo: Conversation): number {
  for (const m of convo.messages) {
    if (!m.IsSender) return m.MessageInfo.TimestampNanos;
  }
  return 0;
}

export const MockBubble: FC<{
  username: string;
  avatar: string;
  timestamp: string;
  text: string;
  direction: string;
}> = ({ username, avatar, timestamp, text, direction = "left" }) => {
  return (
    <>
      {direction == "receiver" && (
        <div className="flex flex-row items-start gap-3">
          <div className="flex flex-col w-[60px] top-2 relative justify-center items-center">
            <img src={avatar} className="w-[38px] rounded-full mb-2" />
            <span className="whitespace-nowrap text-xs text-gray-500">
              {timestamp}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <div className="mb-2 text-[#34F080] text-xs">{username}</div>
            <div className="text-xs w-auto bg-[#141c2b] border border-white/6 rounded-2xl rounded-bl-sm pl-5 mt-auto mb-2 md:mb-5 py-2 px-2 md:px-4 text-white break-words flex text-left relative items-center">
              <div className="text-white text-sm">{text}</div>
            </div>
          </div>
        </div>
      )}
      {direction == "sender" && (
        <div className="flex flex-row-reverse items-start gap-3">
          <div className="flex flex-col w-[60px] justify-center items-center">
            <img src={avatar} className="w-[38px] rounded-full mb-2" />
            <span className="whitespace-nowrap text-xs text-gray-500">
              {timestamp}
            </span>
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

/**
 * Build a dedup key for matching optimistic messages to blockchain-confirmed ones.
 * Includes ExtraData fingerprint so media messages (images, videos, GIFs) with
 * identical or empty captions don't collide.
 */
function msgDedupeKey(
  senderPk: string,
  text: string | undefined,
  extraData?: Record<string, string>
): string {
  let key = senderPk + ":" + (text?.slice(0, 50) ?? "");
  if (extraData) {
    // Use media URLs as discriminators — they're unique per upload
    const media =
      extraData.encryptedImageURLs ||
      extraData.encryptedVideoURLs ||
      extraData["msg:gifUrl"] ||
      "";
    if (media) key += ":" + media.slice(0, 120);
  }
  return key;
}

export const MessagingApp: FC = () => {
  // State — only these cause re-renders (useShallow does shallow equality)
  const {
    appUser,
    isLoadingUser,
    allAccessGroups,
    lockRefresh,
    followedUsers,
    approvedUsers,
    blockedUsers,
    initiatedChats,
    chatRequestsLoaded,
    archivedGroups,
    archivedChats,
    dismissedUsers,
    unreadByConversation,
    mutedConversations,
  } = useStore(
    useShallow((s) => ({
      appUser: s.appUser,
      isLoadingUser: s.isLoadingUser,
      allAccessGroups: s.allAccessGroups,
      lockRefresh: s.lockRefresh,
      followedUsers: s.followedUsers,
      approvedUsers: s.approvedUsers,
      blockedUsers: s.blockedUsers,
      initiatedChats: s.initiatedChats,
      chatRequestsLoaded: s.chatRequestsLoaded,
      archivedGroups: s.archivedGroups,
      archivedChats: s.archivedChats,
      dismissedUsers: s.dismissedUsers,
      unreadByConversation: s.unreadByConversation,
      mutedConversations: s.mutedConversations,
    }))
  );
  // Actions — stable references, never cause re-renders
  const setAllAccessGroups = useStore((s) => s.setAllAccessGroups);
  const setLockRefresh = useStore((s) => s.setLockRefresh);
  const setClassificationData = useStore((s) => s.setClassificationData);
  const addInitiatedChat = useStore((s) => s.addInitiatedChat);
  const approveUser = useStore((s) => s.approveUser);
  const rollbackApproval = useStore((s) => s.rollbackApproval);
  const blockUser = useStore((s) => s.blockUser);
  const rollbackBlock = useStore((s) => s.rollbackBlock);
  const archiveGroup = useStore((s) => s.archiveGroup);
  const unarchiveGroup = useStore((s) => s.unarchiveGroup);
  const rollbackArchive = useStore((s) => s.rollbackArchive);
  const rollbackUnarchive = useStore((s) => s.rollbackUnarchive);
  const mergeArchivedGroupIds = useStore((s) => s.mergeArchivedGroupIds);
  const archiveChat = useStore((s) => s.archiveChat);
  const unarchiveChat = useStore((s) => s.unarchiveChat);
  const rollbackArchiveChat = useStore((s) => s.rollbackArchiveChat);
  const rollbackUnarchiveChat = useStore((s) => s.rollbackUnarchiveChat);
  const mergeArchivedChatIds = useStore((s) => s.mergeArchivedChatIds);
  const dismissUser = useStore((s) => s.dismissUser);
  const undismissUser = useStore((s) => s.undismissUser);
  const rollbackDismiss = useStore((s) => s.rollbackDismiss);
  const rollbackUndismiss = useStore((s) => s.rollbackUndismiss);
  const mergeDismissedIds = useStore((s) => s.mergeDismissedIds);
  const unblockUser = useStore((s) => s.unblockUser);
  const rollbackUnblock = useStore((s) => s.rollbackUnblock);
  const clearUnread = useStore((s) => s.clearUnread);
  const initializeUnread = useStore((s) => s.initializeUnread);
  const toggleMute = useStore((s) => s.toggleMute);
  const setJoinRequestCounts = useStore((s) => s.setJoinRequestCounts);
  const [usernameByPublicKeyBase58Check, setUsernameByPublicKeyBase58Check] =
    useState<{ [key: string]: string }>({});
  const [profilePicByPublicKey, setProfilePicByPublicKey] = useState<{
    [key: string]: string;
  }>({});
  // autoFetchConversations was removed — conversationsLoading now tracks this
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, setPubKeyPlusGroupName] = useState<string>("");
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null
  );
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
    sender: string;
  } | null>(null);
  const sendInputRef = useRef<SendMessageInputHandle>(null);
  const [editingMessage, setEditingMessage] = useState<{
    text: string;
    timestamp: string;
  } | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(
    new Set()
  );
  // Captured at conversation-open time, before we update it to the latest message.
  // Passed to MessagingBubblesAndAvatar so it can render the "new messages" divider.
  const [openedLastReadNanos, setOpenedLastReadNanos] = useState<number | null>(
    null
  );
  const [tipTarget, setTipTarget] = useState<{
    recipientPublicKey: string;
    recipientUsername?: string;
    tipReplyTo?: string;
    initialAmountUsd?: number;
  } | null>(null);
  const [pendingTipTimestamps, setPendingTipTimestamps] = useState<Set<string>>(
    new Set()
  );
  const [dmMenuOpen, setDmMenuOpen] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState<{
    conversationKey: string;
    publicKey: string;
    name: string;
  } | null>(null);
  const { isMobile } = useMobile();
  const isIdle = useIdleDetection();

  // Adaptive polling: starts at base interval, backs off additively each cycle,
  // resets on WebSocket activity, and pauses entirely when user is idle.
  const baseDelay = isMobile
    ? REFRESH_MESSAGES_MOBILE_INTERVAL_MS
    : REFRESH_MESSAGES_INTERVAL_MS;
  const [pollingDelay, setPollingDelay] = useState<number | null>(baseDelay);

  // Pause polling when idle, resume at base rate when active
  useEffect(() => {
    setPollingDelay(isIdle ? null : baseDelay);
  }, [isIdle, baseDelay]);

  // Debounce foreground resume to prevent bursty API calls on rapid tab switches
  const lastResumeRef = useRef(0);

  // Close DM menu, block dialog, and tip dialog when switching conversations
  useEffect(() => {
    setDmMenuOpen(false);
    setBlockConfirm(null);
    setTipTarget(null);
    setPendingTipTimestamps(new Set());
    // Pre-warm exchange rate cache so micro-tips don't hit a cold fetch
    fetchExchangeRate().catch(() => {});
  }, [selectedConversationPublicKey]);

  // Proactively tell the service worker which conversation is active so it can
  // suppress push notifications for the conversation the user is viewing.
  // Uses controller when available, falls back to registration.active for the
  // first page load before clientsClaim takes effect (controller can be null).
  // If the SW restarts, the variable resets to null (fail-open: all notifications show).
  //
  // The SW uses a 10s TTL on activeConversationKey to guard against iOS not
  // firing visibilitychange when the PWA is backgrounded. A 5s heartbeat keeps
  // the TTL alive while the user is genuinely viewing the conversation.
  useEffect(() => {
    const sendActiveConversation = () => {
      const msg = {
        type: "set-active-conversation",
        conversationKey: selectedConversationPublicKey || null,
      };
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      } else {
        navigator.serviceWorker?.ready.then((reg) =>
          reg.active?.postMessage(msg)
        );
      }
    };

    sendActiveConversation();

    // Heartbeat: re-send every 5s so the SW's 10s TTL stays fresh
    const heartbeat = selectedConversationPublicKey
      ? setInterval(sendActiveConversation, 5_000)
      : undefined;

    return () => clearInterval(heartbeat);
  }, [selectedConversationPublicKey]);

  // Clear the active conversation when the tab loses focus or is closed,
  // so notifications resume immediately.
  useEffect(() => {
    const sendToSW = (conversationKey: string | null) => {
      const msg = { type: "set-active-conversation", conversationKey };
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      } else {
        navigator.serviceWorker?.ready.then((reg) =>
          reg.active?.postMessage(msg)
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendToSW(null);
      } else if (selectedConversationPublicKeyRef.current) {
        sendToSW(selectedConversationPublicKeyRef.current);
      }
    };

    const handleBeforeUnload = () => sendToSW(null);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

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

  // Ref that always reflects the latest accumulated username map.
  // React state updates are batched, so reading `usernameByPublicKeyBase58Check`
  // inside an async callback gives a stale value. This ref is updated alongside
  // every `setUsernameByPublicKeyBase58Check` call so dedup checks in
  // `fetchUsersStateless` never re-fetch keys we already resolved.
  const usernameMapRef = useRef<Record<string, string>>({});

  // Helper: update both state and ref in one call.
  // The ref is mutated in-place (never rendered directly) to avoid
  // O(n) shallow-copies when called multiple times in a row.
  const mergeUsernames = (patch: Record<string, string>) => {
    Object.assign(usernameMapRef.current, patch);
    setUsernameByPublicKeyBase58Check((s) => ({ ...s, ...patch }));
  };

  // Refs for accessing latest state inside callbacks without causing re-renders
  const lockRefreshRef = useRef(lockRefresh);
  lockRefreshRef.current = lockRefresh;
  const selectedConversationPublicKeyRef = useRef(
    selectedConversationPublicKey
  );
  selectedConversationPublicKeyRef.current = selectedConversationPublicKey;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const allAccessGroupsRef = useRef(allAccessGroups);
  allAccessGroupsRef.current = allAccessGroups;

  // Shared merge logic: reconcile optimistic messages with blockchain-confirmed data.
  // Used by both the WebSocket handler and the polling interval.
  const mergeConversationUpdate = useCallback(
    (
      updatedConversations: ConversationMap,
      selectedKey: string,
      updatedMessages: DecryptedMessageEntryResponse[]
    ) => {
      let hasNewlyConfirmed = false;

      setConversations((prev) => {
        const currentMessages = prev[selectedKey]?.messages || [];

        const optimisticMessages = currentMessages.filter(
          (m: any) => m._localId
        );

        // Map dedup key → _localId so we can transfer it to the confirmed message
        const optimisticByKey = new Map<string, string>();
        for (const m of optimisticMessages) {
          const key = msgDedupeKey(
            (m as any).SenderInfo.OwnerPublicKeyBase58Check,
            (m as any).DecryptedMessage,
            (m as any).MessageInfo?.ExtraData
          );
          optimisticByKey.set(key, (m as any)._localId);
        }

        const confirmedKeys = new Set(
          updatedMessages.map((m) =>
            msgDedupeKey(
              m.SenderInfo.OwnerPublicKeyBase58Check,
              m.DecryptedMessage,
              m.MessageInfo?.ExtraData
            )
          )
        );

        const stillPendingOptimistic = optimisticMessages.filter(
          (m: any) =>
            !confirmedKeys.has(
              msgDedupeKey(
                m.SenderInfo.OwnerPublicKeyBase58Check,
                m.DecryptedMessage,
                m.MessageInfo?.ExtraData
              )
            )
        );

        // Tag blockchain messages that just confirmed an optimistic entry:
        // transfer _localId (keeps React key stable) and set _status: "confirmed"
        // so the user sees the double-checkmark briefly before it fades out.
        const taggedMessages = updatedMessages.map((m) => {
          const key = msgDedupeKey(
            m.SenderInfo.OwnerPublicKeyBase58Check,
            m.DecryptedMessage,
            m.MessageInfo?.ExtraData
          );
          const localId = optimisticByKey.get(key);
          if (localId) {
            hasNewlyConfirmed = true;
            return { ...m, _status: "confirmed" as const, _localId: localId };
          }
          return m;
        });

        const merged = {
          ...prev,
          [selectedKey]: {
            ...prev[selectedKey],
            messages: [...stillPendingOptimistic, ...taggedMessages],
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

      // Strip confirmed tags after the CSS animation completes (pop-in 300ms +
      // hold + fade-out at 1.2s for 300ms = 1.5s total). The composite animation
      // on .status-confirm-enter handles the visual lifecycle purely in CSS,
      // so we only need this single state update to clean up.
      if (hasNewlyConfirmed) {
        setTimeout(() => {
          setConversations((prev) => {
            const conv = prev[selectedKey];
            if (!conv) return prev;
            const hasConfirmed = conv.messages.some(
              (m: any) => m._status === "confirmed"
            );
            if (!hasConfirmed) return prev;
            return {
              ...prev,
              [selectedKey]: {
                ...conv,
                messages: conv.messages.map((m: any) => {
                  if (m._status !== "confirmed") return m;
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { _status, _localId, ...rest } = m;
                  return rest;
                }),
              },
            };
          });
        }, 1500);
      }
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
            const optimistic = merged[key].messages.filter(
              (m: any) => m._localId
            );
            merged[key] = {
              ...convo,
              messages: [...optimistic, ...convo.messages],
            };
          }
        }
        if (appUser) cacheConversations(appUser.PublicKeyBase58Check, merged);
        return merged;
      });
    },
    [appUser]
  );

  // Dedicated sender-side confirmation poller: after a message is sent, poll the
  // single conversation at short intervals to confirm the message on-chain quickly
  // instead of waiting for the general poll cycle (15s–5min).
  //
  // Coalesced per-conversation: rapid-fire sends share a single poller per conv
  // instead of spawning one poller per message, avoiding API call storms.
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingConfirmationsRef = useRef<
    Map<
      string,
      {
        localIds: Set<string>;
        chatType: ChatType;
        firstMessagePublicKey: string;
        recipientGroupKeyName: string;
        attempt: number;
      }
    >
  >(new Map());
  // Clean up confirmation timer on unmount
  useEffect(
    () => () => {
      if (confirmationTimerRef.current)
        clearTimeout(confirmationTimerRef.current);
    },
    []
  );

  const CONFIRM_MAX_ATTEMPTS = 8;
  const CONFIRM_INTERVAL_MS = 3000;

  const runConfirmationCheck = useCallback(async () => {
    confirmationTimerRef.current = null;
    if (!appUser) return;
    const myPk = appUser.PublicKeyBase58Check;
    const pending = pendingConfirmationsRef.current;
    if (pending.size === 0) return;

    // Process each conversation with pending confirmations
    const convKeysToRemove: string[] = [];
    for (const [convKey, entry] of pending) {
      entry.attempt++;
      try {
        // Remove localIds already confirmed by normal polling
        const conv = conversationsRef.current[convKey];
        if (!conv) {
          convKeysToRemove.push(convKey);
          continue;
        }
        const activeLocalIds = conv.messages
          .filter((m: any) => m._localId && entry.localIds.has(m._localId))
          .map((m: any) => m._localId as string);
        if (activeLocalIds.length === 0) {
          convKeysToRemove.push(convKey);
          continue;
        }
        // Update the set to only track still-pending messages
        entry.localIds = new Set(activeLocalIds);

        // Lightweight single-conversation fetch
        let decrypted: DecryptedMessageEntryResponse[];
        if (entry.chatType === ChatType.DM) {
          const resp = await getPaginatedDMThread({
            UserGroupOwnerPublicKeyBase58Check: myPk,
            UserGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            PartyGroupOwnerPublicKeyBase58Check: entry.firstMessagePublicKey,
            PartyGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
            StartTimeStamp: new Date().valueOf() * 1e6,
          });
          const result = await decryptAccessGroupMessagesWithRetry(
            myPk,
            resp.ThreadMessages,
            allAccessGroupsRef.current
          );
          decrypted = result.decrypted;
        } else {
          const resp = await getPaginatedGroupChatThread({
            UserPublicKeyBase58Check: entry.firstMessagePublicKey,
            AccessGroupKeyName: entry.recipientGroupKeyName,
            StartTimeStamp: new Date().valueOf() * 1e6,
            MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
          });
          const result = await decryptAccessGroupMessagesWithRetry(
            myPk,
            resp.GroupChatMessages,
            allAccessGroupsRef.current
          );
          decrypted = result.decrypted;
        }

        // Check if any pending messages now appear on-chain
        const currentConv = conversationsRef.current[convKey];
        if (!currentConv) {
          convKeysToRemove.push(convKey);
          continue;
        }

        const anyFound = currentConv.messages.some((m: any) => {
          if (!m._localId || !entry.localIds.has(m._localId)) return false;
          const targetKey = msgDedupeKey(
            m.SenderInfo.OwnerPublicKeyBase58Check,
            m.DecryptedMessage,
            m.MessageInfo?.ExtraData
          );
          return decrypted.some(
            (d) =>
              msgDedupeKey(
                d.SenderInfo.OwnerPublicKeyBase58Check,
                d.DecryptedMessage,
                d.MessageInfo?.ExtraData
              ) === targetKey
          );
        });

        if (anyFound) {
          // At least one message confirmed — merge full thread to reconcile all
          mergeConversationUpdate(
            {
              ...conversationsRef.current,
              [convKey]: { ...currentConv, messages: decrypted },
            },
            convKey,
            decrypted
          );
          // Remove confirmed localIds; mergeConversationUpdate handles the rest
          convKeysToRemove.push(convKey);
        } else if (entry.attempt >= CONFIRM_MAX_ATTEMPTS) {
          convKeysToRemove.push(convKey);
        }
      } catch {
        // Silently ignore — normal polling is the fallback
        if (entry.attempt >= CONFIRM_MAX_ATTEMPTS) {
          convKeysToRemove.push(convKey);
        }
      }
    }

    for (const key of convKeysToRemove) {
      pending.delete(key);
    }

    // Schedule next tick if there are still pending confirmations
    if (pending.size > 0) {
      confirmationTimerRef.current = setTimeout(
        runConfirmationCheck,
        CONFIRM_INTERVAL_MS
      );
    }
  }, [appUser, mergeConversationUpdate]);

  const scheduleConfirmationCheck = useCallback(
    (
      convKey: string,
      localId: string,
      chatType: ChatType,
      firstMessagePublicKey: string,
      recipientGroupKeyName: string
    ) => {
      const pending = pendingConfirmationsRef.current;
      const existing = pending.get(convKey);
      if (existing) {
        // Coalesce: add this message to the existing conversation poller
        existing.localIds.add(localId);
      } else {
        pending.set(convKey, {
          localIds: new Set([localId]),
          chatType,
          firstMessagePublicKey,
          recipientGroupKeyName,
          attempt: 0,
        });
      }

      // Ensure the shared timer is running
      if (!confirmationTimerRef.current) {
        confirmationTimerRef.current = setTimeout(
          runConfirmationCheck,
          CONFIRM_INTERVAL_MS
        );
      }
    },
    [runConfirmationCheck]
  );

  // Guard against concurrent WS-triggered fetches (e.g. rapid-fire notifications)
  const wsFetchingRef = useRef(false);
  // Guard against overlapping polling ticks (setInterval fires even if previous callback is still async)
  const pollingRef = useRef(false);
  const welcomeMessageSentRef = useRef(false);

  // Real-time WebSocket relay
  const handleWsNewMessage = useCallback(
    (threadId: string, _from: string) => {
      if (!appUser || wsFetchingRef.current) return;
      wsFetchingRef.current = true;

      // WS is delivering messages — keep the slow safety-net rate.
      // No need to reset to base delay since real-time is handled by WS.

      getConversationsDifferential(
        appUser.PublicKeyBase58Check,
        allAccessGroups
      )
        .then(
          async ({
            conversations: updated,
            updatedAllAccessGroups,
            publicKeyToProfileEntryResponseMap,
          }) => {
            setAllAccessGroups(updatedAllAccessGroups);

            // Update username + profile pic maps from fresh profile data
            const freshUsernames: Record<string, string> = {};
            const freshPics: Record<string, string> = {};
            for (const [pk, profile] of Object.entries(
              publicKeyToProfileEntryResponseMap
            )) {
              if (profile?.Username) freshUsernames[pk] = profile.Username;
              const ed = profile?.ExtraData;
              if (ed) {
                const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
                if (picUrl) freshPics[pk] = picUrl;
              }
            }
            if (Object.keys(freshUsernames).length) {
              mergeUsernames(freshUsernames);
            }
            if (Object.keys(freshPics).length) {
              setProfilePicByPublicKey((s) => ({ ...s, ...freshPics }));
            }

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
                if (
                  selectedConversationPublicKeyRef.current !==
                  currentSelectedKey
                ) {
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
                    const ts = updatedMessages[0].MessageInfo.TimestampNanos;
                    cacheLastReadTimestamp(
                      appUser.PublicKeyBase58Check,
                      currentSelectedKey,
                      ts
                    );
                    sendRead(currentSelectedKey, String(ts));
                  }
                }
              } catch {
                // Fall back to the simple conversation-list merge
                simpleConversationMerge(updated);
              }
            } else {
              // Different conversation — just merge the conversation list
              simpleConversationMerge(updated);

              const isDmConvo =
                updated[localThreadId]?.ChatType === ChatType.DM;
              if (
                localThreadId &&
                !useStore.getState().mutedConversations.has(localThreadId) &&
                !useStore.getState().archivedGroups.has(localThreadId) &&
                !(
                  isDmConvo &&
                  _from &&
                  useStore.getState().blockedUsers.has(_from)
                ) &&
                !(
                  isDmConvo &&
                  _from &&
                  useStore.getState().dismissedUsers.has(_from)
                ) &&
                !(
                  isDmConvo &&
                  _from &&
                  useStore.getState().archivedChats.has(_from)
                )
              ) {
                useStore.getState().incrementUnread(localThreadId);
              } else if (!localThreadId) {
                // Resume from background — fetch full thread and compute
                // unread in parallel (they're independent operations).
                const threadPromise =
                  currentSelectedKey && updated[currentSelectedKey]
                    ? getConversation(currentSelectedKey, {
                        ...updated,
                        [currentSelectedKey]: updated[currentSelectedKey],
                      })
                        .then(
                          ({
                            updatedConversations,
                            pubKeyPlusGroupName: newPubKey,
                          }) => {
                            // Guard: user may have switched conversations during the await
                            if (
                              selectedConversationPublicKeyRef.current !==
                              currentSelectedKey
                            )
                              return;
                            const updatedMessages =
                              updatedConversations[currentSelectedKey]
                                ?.messages;
                            if (updatedMessages) {
                              mergeConversationUpdate(
                                updatedConversations,
                                currentSelectedKey,
                                updatedMessages
                              );
                              setPubKeyPlusGroupName(newPubKey);
                              if (updatedMessages[0]) {
                                const ts =
                                  updatedMessages[0].MessageInfo.TimestampNanos;
                                cacheLastReadTimestamp(
                                  appUser.PublicKeyBase58Check,
                                  currentSelectedKey,
                                  ts
                                );
                                sendRead(currentSelectedKey, String(ts));
                              }
                            }
                          }
                        )
                        .catch(() => {
                          // Full thread fetch failed — simple merge already applied above
                        })
                    : Promise.resolve();

                // Compute unread from timestamps (no await needed — sync reads)
                const lastReadTimestamps = getCachedLastReadTimestamps(
                  appUser.PublicKeyBase58Check
                );
                const store = useStore.getState();
                const unreadMap = new Map<string, number>();
                for (const [k, convo] of Object.entries(updated)) {
                  if (k === currentSelectedKey) continue;
                  if (
                    store.mutedConversations.has(k) ||
                    store.archivedGroups.has(k)
                  )
                    continue;
                  const msgTs = latestIncomingTimestamp(convo);
                  if (!msgTs) continue;
                  const lastRead = lastReadTimestamps[k];
                  if (lastRead === undefined) {
                    cacheLastReadTimestamp(
                      appUser.PublicKeyBase58Check,
                      k,
                      msgTs
                    );
                  } else if (msgTs > lastRead) {
                    unreadMap.set(k, 1);
                  }
                }
                syncUnreadConversations(Array.from(unreadMap.keys()));
                if (unreadMap.size > 0) {
                  useStore.getState().initializeUnread(unreadMap);
                } else {
                  navigator.clearAppBadge?.()?.catch?.(() => {});
                }

                // Wait for thread fetch before releasing wsFetchingRef
                await threadPromise;
              }
            }
          }
        )
        .catch(() => {
          // WS-triggered differential fetch failed — temporarily reset polling
          // to base rate so we retry soon instead of waiting 5 minutes.
          // Only reset if user is active — don't override idle pause.
          if (!isIdleRef.current) {
            setPollingDelay(baseDelay);
          }
        })
        .finally(() => {
          wsFetchingRef.current = false;
        });
    },
    [
      appUser,
      allAccessGroups,
      mergeConversationUpdate,
      simpleConversationMerge,
      baseDelay,
    ]
  );

  const { onTypingReceived, getTypingUsersForConversation } =
    useTypingDisplay();

  const setOnlineUsers = useStore((s) => s.setOnlineUsers);
  const { getPresence, getOnlineCount, fetchPresenceForKeys } = usePresence();

  const {
    sendNotify,
    sendTyping,
    sendRead,
    sendReadSyncInit,
    isConnected: wsConnected,
  } = useWebSocket({
    onNewMessage: handleWsNewMessage,
    onTyping: onTypingReceived,
    onPresence: (users) => {
      setOnlineUsers(new Set(Object.keys(users)));
    },
    onReadSync: (conversationKey, timestamp) => {
      // Another device read this conversation — update local state
      const user = useStore.getState().appUser;
      if (!user) return;
      const ts = Number(timestamp);
      cacheLastReadTimestamp(user.PublicKeyBase58Check, conversationKey, ts);
      // Clear unread if cursor >= latest incoming message
      const convo = conversationsRef.current[conversationKey];
      const incomingTs = convo ? latestIncomingTimestamp(convo) : 0;
      if (incomingTs && ts >= incomingTs) {
        clearUnread(conversationKey);
        removeUnreadConversation(conversationKey);
      }
    },
    onReadSyncBulk: (cursors) => {
      const user = useStore.getState().appUser;
      if (!user) return;
      const pk = user.PublicKeyBase58Check;
      const { merged, localNewer } = mergeReadCursors(pk, cursors);
      // Send back any cursors that are newer locally
      if (Object.keys(localNewer).length > 0) {
        sendReadSyncInit(localNewer);
      }
      // Recompute unread badges from merged cursors
      const store = useStore.getState();
      const convos = conversationsRef.current;
      const unreadMap = new Map<string, number>();
      // Track conversations we positively confirmed as read (cursor >= latest
      // incoming message). Only these should have their badges cleared —
      // skipping a conversation (no messages, missing cursor, etc.) must NOT
      // remove an existing badge set by incrementUnread.
      const confirmedRead = new Set<string>();
      const currentKey = selectedConversationPublicKeyRef.current;
      for (const [k, convo] of Object.entries(convos)) {
        if (k === currentKey) continue; // Viewing — already read
        if (store.mutedConversations.has(k) || store.archivedGroups.has(k))
          continue;
        const msgTs = latestIncomingTimestamp(convo);
        if (!msgTs) continue; // No incoming messages — nothing to mark unread
        const lastRead = merged[k];
        if (lastRead === undefined) continue; // No cursor — preserve existing state
        if (msgTs > lastRead) {
          unreadMap.set(k, 1);
        } else {
          confirmedRead.add(k);
        }
      }
      // Only clear conversations we have positive evidence are read
      for (const existingKey of store.unreadByConversation.keys()) {
        if (confirmedRead.has(existingKey)) {
          clearUnread(existingKey);
          removeUnreadConversation(existingKey);
        }
      }
      syncUnreadConversations(Array.from(unreadMap.keys()));
      if (unreadMap.size > 0) {
        initializeUnread(unreadMap);
      }
    },
  });

  const { onKeystroke } = useTypingIndicator(sendTyping);

  // When WebSocket is connected, slow polling to a safety-net interval (5 min).
  // When it disconnects, resume normal polling so we don't miss messages.
  useEffect(() => {
    if (isIdle) return; // idle effect handles pause
    setPollingDelay(wsConnected ? REFRESH_MESSAGES_WS_CONNECTED_MS : baseDelay);
  }, [wsConnected, baseDelay, isIdle]);

  // Derive classified conversation maps from the single conversations state + store Sets
  const { chatConversations, requestConversations, archivedConversations } =
    useMemo(() => {
      if (!appUser)
        return {
          chatConversations: {} as ConversationMap,
          requestConversations: {} as ConversationMap,
          archivedConversations: {} as ConversationMap,
        };
      const chats: ConversationMap = {};
      const requests: ConversationMap = {};
      const archived: ConversationMap = {};
      for (const [key, convo] of Object.entries(conversations)) {
        const cls = classifyConversation(
          convo,
          key,
          appUser.PublicKeyBase58Check,
          followedUsers,
          approvedUsers,
          blockedUsers,
          initiatedChats,
          archivedGroups,
          archivedChats,
          dismissedUsers
        );
        if (cls === "chat") chats[key] = convo;
        else if (cls === "request") requests[key] = convo;
        else if (cls === "archived") archived[key] = convo;
        // "blocked" and "dismissed" → omitted
      }
      return {
        chatConversations: chats,
        requestConversations: requests,
        archivedConversations: archived,
      };
    }, [
      conversations,
      followedUsers,
      approvedUsers,
      blockedUsers,
      initiatedChats,
      archivedGroups,
      archivedChats,
      dismissedUsers,
      appUser,
    ]);

  // Compute per-conversation highlights: unread @mentions and reactions to my messages.
  // Uses the most recent messages loaded in each conversation (the preview page).
  // rerender-dependencies: depend on primitive publicKey, not the appUser object ref.
  const myPublicKey = appUser?.PublicKeyBase58Check;
  const highlightsByConversation = useMemo(() => {
    if (!myPublicKey)
      return new Map<string, { hasMention: boolean; hasReaction: boolean }>();
    const lastReadTimestamps = getCachedLastReadTimestamps(myPublicKey);
    const result = new Map<
      string,
      { hasMention: boolean; hasReaction: boolean }
    >();
    for (const [key, convo] of Object.entries(conversations)) {
      const lastRead = lastReadTimestamps[key];
      if (lastRead === undefined) continue;
      let hasMention = false;
      let hasReaction = false;
      // Build set of my message timestamps for reaction target lookup
      const myTimestamps = new Set<string>();
      for (const msg of convo.messages) {
        if (
          msg.IsSender ||
          msg.SenderInfo.OwnerPublicKeyBase58Check === myPublicKey
        ) {
          myTimestamps.add(msg.MessageInfo.TimestampNanosString);
        }
      }
      for (const msg of convo.messages) {
        if (msg.MessageInfo.TimestampNanos <= lastRead) break; // sorted newest-first
        if (
          msg.IsSender ||
          msg.SenderInfo.OwnerPublicKeyBase58Check === myPublicKey
        )
          continue;
        const parsed = parseMessageType(msg);
        if (
          !hasMention &&
          parsed.mentions &&
          parsed.mentions.some((m) => m.pk === myPublicKey)
        ) {
          hasMention = true;
        }
        if (
          !hasReaction &&
          parsed.type === "reaction" &&
          parsed.replyTo &&
          parsed.action !== "remove" &&
          myTimestamps.has(parsed.replyTo)
        ) {
          hasReaction = true;
        }
        if (hasMention && hasReaction) break;
      }
      if (hasMention || hasReaction) {
        result.set(key, { hasMention, hasReaction });
      }
    }
    return result;
  }, [conversations, myPublicKey, unreadByConversation]); // unreadByConversation triggers recompute on new messages

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

  const handleAcceptRequest = async (
    conversationKey: string,
    publicKey: string
  ) => {
    if (!appUser) return;
    approveUser(publicKey);
    // Clear search so the conversation appears in the right tab
    if (searchQuery) {
      clearSearch();
      setSearchClearTrigger((n) => n + 1);
    }
    try {
      await createApprovalAssociation(appUser.PublicKeyBase58Check, publicKey);
    } catch {
      rollbackApproval(publicKey);
      toast.error("Failed to accept chat request");
    }
  };

  const handleBlockRequest = async (
    conversationKey: string,
    publicKey: string
  ) => {
    if (!appUser) return;
    blockUser(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createBlockAssociation(appUser.PublicKeyBase58Check, publicKey);
      toast("User blocked", {
        action: { label: "Undo", onClick: () => handleUnblock(publicKey) },
      });
      // Background-fetch the association ID so unblock works
      fetchAssociationsByType(
        appUser.PublicKeyBase58Check,
        ASSOCIATION_TYPE_BLOCKED
      )
        .then((ids) => {
          const current = useStore.getState().blockedAssociationIds;
          const next = new Map(current);
          for (const [k, v] of ids) next.set(k, v);
          useStore.setState({ blockedAssociationIds: next });
        })
        .catch(() => {});
    } catch {
      rollbackBlock(publicKey);
      toast.error("Failed to block user");
    }
  };

  const handleArchiveGroup = async (
    conversationKey: string,
    groupOwnerPublicKey: string,
    groupKeyName: string
  ) => {
    if (!appUser) return;

    // Best-effort: send "left" system message while still a member
    const username =
      appUser.ProfileEntryResponse?.Username ||
      appUser.PublicKeyBase58Check.slice(0, 8);
    sendSystemMessage(
      appUser.PublicKeyBase58Check,
      groupOwnerPublicKey,
      groupKeyName,
      "member-left",
      [{ pk: appUser.PublicKeyBase58Check, un: username }]
    );

    archiveGroup(conversationKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createArchiveAssociation(
        appUser.PublicKeyBase58Check,
        groupOwnerPublicKey,
        groupKeyName
      );
      toast("Left group chat", {
        action: {
          label: "Undo",
          onClick: () => handleUnarchiveGroup(conversationKey),
        },
      });
      // Background: fetch the association ID so Rejoin works without page refresh
      fetchArchivedGroups(appUser.PublicKeyBase58Check)
        .then((ids) => mergeArchivedGroupIds(ids))
        .catch(() => {});
    } catch {
      rollbackArchive(conversationKey);
      toast.error("Failed to leave group");
    }
  };

  const handleOptimisticSystemMessage = useCallback(
    (members: MentionEntry[]) => {
      if (!appUser) return;
      const key = selectedConversationPublicKeyRef.current;
      if (!key) return;

      const names = members.map((m) => m.un || m.pk.slice(0, 8));
      const label =
        names.length <= 3
          ? names.join(", ")
          : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
      const fallback = `${label} joined the group`;

      const TimestampNanos = Date.now() * 1e6;
      const localId = `sys-${crypto.randomUUID()}`;

      setConversations((prev) => {
        const c = prev[key];
        if (!c?.messages.length) return prev;
        const recipient = c.messages[0].RecipientInfo;

        const mockMessage = {
          DecryptedMessage: fallback,
          IsSender: true,
          _status: "sending" as const,
          _localId: localId,
          SenderInfo: {
            OwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            AccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          },
          RecipientInfo: {
            OwnerPublicKeyBase58Check: recipient.OwnerPublicKeyBase58Check,
            AccessGroupKeyName: recipient.AccessGroupKeyName,
          },
          MessageInfo: {
            TimestampNanos,
            TimestampNanosString: String(TimestampNanos),
            ExtraData: buildExtraData({
              type: "system",
              systemAction: "member-joined",
              systemMembers: members,
            }),
          },
        } as DecryptedMessageEntryResponse & {
          _status: string;
          _localId: string;
        };

        return {
          ...prev,
          [key]: { ...c, messages: [mockMessage, ...c.messages] },
        };
      });
    },
    [appUser]
  );

  const handleUnarchiveGroup = async (conversationKey: string) => {
    if (!appUser) return;
    const associationId = useStore
      .getState()
      .archivedGroupAssociationIds.get(conversationKey);
    if (!associationId) {
      toast.error("Cannot rejoin — association not found");
      return;
    }
    unarchiveGroup(conversationKey);
    try {
      await deleteArchiveAssociation(
        appUser.PublicKeyBase58Check,
        associationId
      );
      toast.success("Rejoined group chat");
    } catch {
      rollbackUnarchive(conversationKey, associationId);
      toast.error("Failed to rejoin group");
    }
  };

  // ── Archive DM chat ──
  const handleArchiveChat = async (
    conversationKey: string,
    publicKey: string
  ) => {
    if (!appUser) return;
    archiveChat(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createArchiveChatAssociation(
        appUser.PublicKeyBase58Check,
        publicKey
      );
      toast("Chat archived", {
        action: {
          label: "Undo",
          onClick: () => handleUnarchiveChat(publicKey),
        },
      });
      // Background-fetch the association ID so unarchive works
      fetchAssociationsByType(
        appUser.PublicKeyBase58Check,
        ASSOCIATION_TYPE_CHAT_ARCHIVED
      )
        .then((ids) => mergeArchivedChatIds(ids))
        .catch(() => {});
    } catch {
      rollbackArchiveChat(publicKey);
      toast.error("Failed to archive chat");
    }
  };

  const handleUnarchiveChat = async (publicKey: string) => {
    if (!appUser) return;
    // Read latest from store — not the stale closure — since the ID arrives via background fetch
    const associationId = useStore
      .getState()
      .archivedChatAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error(
        "Cannot unarchive — association not found. Try again in a moment."
      );
      return;
    }
    unarchiveChat(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("Chat unarchived");
    } catch {
      rollbackUnarchiveChat(publicKey, associationId);
      toast.error("Failed to unarchive chat");
    }
  };

  // ── Dismiss request ──
  const handleDismissRequest = async (
    conversationKey: string,
    publicKey: string
  ) => {
    if (!appUser) return;
    dismissUser(publicKey);
    cleanupAfterClassificationChange(conversationKey);
    try {
      await createDismissAssociation(appUser.PublicKeyBase58Check, publicKey);
      toast("Request dismissed", {
        action: { label: "Undo", onClick: () => handleUndismiss(publicKey) },
      });
      // Background-fetch the association ID so undo works
      fetchAssociationsByType(
        appUser.PublicKeyBase58Check,
        ASSOCIATION_TYPE_DISMISSED
      )
        .then((ids) => mergeDismissedIds(ids))
        .catch(() => {});
    } catch {
      rollbackDismiss(publicKey);
      toast.error("Failed to dismiss request");
    }
  };

  const handleUndismiss = async (publicKey: string) => {
    if (!appUser) return;
    const associationId = useStore
      .getState()
      .dismissedAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error(
        "Cannot undo — association not found. Try again in a moment."
      );
      return;
    }
    undismissUser(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("Request restored");
    } catch {
      rollbackUndismiss(publicKey, associationId);
      toast.error("Failed to restore request");
    }
  };

  // ── Unblock user ──
  const handleUnblock = async (publicKey: string) => {
    if (!appUser) return;
    const associationId = useStore
      .getState()
      .blockedAssociationIds.get(publicKey);
    if (!associationId) {
      toast.error(
        "Cannot unblock — association not found. Try again in a moment."
      );
      return;
    }
    unblockUser(publicKey);
    try {
      await deleteAssociationById(appUser.PublicKeyBase58Check, associationId);
      toast.success("User unblocked");
    } catch {
      rollbackUnblock(publicKey, associationId);
      toast.error("Failed to unblock user");
    }
  };

  // Retry a single pending message (used by startup retry and the retry button)
  const retryingIds = useRef(new Set<string>());
  const retryPendingMessage = useCallback(
    async (pending: PendingMessage) => {
      if (!appUser) return;
      const {
        localId,
        conversationKey,
        messageText,
        recipientPublicKey,
        recipientAccessGroupKeyName,
        extraData,
        senderPublicKey,
      } = pending;

      // Don't retry messages from a different account
      if (senderPublicKey && senderPublicKey !== appUser.PublicKeyBase58Check)
        return;

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
      } as DecryptedMessageEntryResponse & {
        _status: string;
        _localId: string;
      };

      // Check if this message already landed on-chain (app closed after
      // blockchain accepted but before we could remove from IndexedDB).
      // Uses the same dedup key as the poll reconciliation.
      const dedupeKey = msgDedupeKey(
        appUser.PublicKeyBase58Check,
        messageText,
        extraData
      );
      const convo = conversationsRef.current[conversationKey];
      if (convo) {
        const alreadyOnChain = convo.messages.some(
          (m: any) =>
            !m._localId &&
            msgDedupeKey(
              m.SenderInfo.OwnerPublicKeyBase58Check,
              m.DecryptedMessage,
              m.MessageInfo?.ExtraData
            ) === dedupeKey
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
          usernameByPublicKeyBase58Check[appUser.PublicKeyBase58Check] ||
            appUser.PublicKeyBase58Check
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
        // Start dedicated confirmation poller for this message
        const retryConv = conversationsRef.current[conversationKey];
        scheduleConfirmationCheck(
          conversationKey,
          localId,
          retryConv?.ChatType ?? ChatType.DM,
          recipientPublicKey,
          recipientAccessGroupKeyName
        );
      } catch (e: any) {
        const errorStr = e?.toString() || "Unknown error";

        const isPermanent = /TxnTooBig|TxnTooLarge|MaxMessageLength/i.test(
          errorStr
        );

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
    if (!appUser || conversationsLoading) return;
    if (pendingRetryRanForUser.current === appUser.PublicKeyBase58Check) return;
    pendingRetryRanForUser.current = appUser.PublicKeyBase58Check;

    getPendingMessages(appUser.PublicKeyBase58Check).then((pendingMsgs) => {
      if (pendingMsgs.length === 0) return;
      toast.info(
        `Retrying ${pendingMsgs.length} unsent message${
          pendingMsgs.length > 1 ? "s" : ""
        }…`,
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
                  const filtered = c.messages.filter(
                    (m: any) => !m._localId || !localIds.has(m._localId)
                  );
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
  }, [appUser, conversationsLoading, retryPendingMessage]);

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
    const switched =
      prevRehydrateUserRef.current &&
      prevRehydrateUserRef.current !== currentKey;
    prevRehydrateUserRef.current = currentKey;

    if (switched) {
      setConversations({});
      usernameMapRef.current = {};
      setUsernameByPublicKeyBase58Check({});
      setProfilePicByPublicKey({});
      setMembersByGroupKey({});
      setHiddenMessageIds(new Set());
      setPubKeyPlusGroupName("");
    }

    // Seed the current user's own username so it's always available for
    // notifications and display, even before conversations are fetched.
    const ownUsername = appUser.ProfileEntryResponse?.Username;
    if (ownUsername) {
      mergeUsernames({ [currentKey]: ownUsername });
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

      setConversationsLoading(true);
      setConversationsError(null);

      // If opened from a notification, always select the conversation even on mobile
      rehydrateConversation(
        pending || "",
        false,
        !isMobile || !!pending,
        isLoadingUser
      );
    }
  }, [appUser, isMobile]);

  // Handle push notification clicks from service worker
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (
        event.data?.type === "notification-click" &&
        event.data.conversationKey
      ) {
        const key = event.data.conversationKey;
        setSelectedConversationPublicKey(key);
        clearUnread(key);
        // Clear the IDB fallback so the visibility-change handler doesn't
        // double-navigate when the fast path (postMessage) already worked.
        consumePendingNotificationConversation();

        // Directly fetch the thread via the paginated endpoint (fast, ~25 msgs)
        // instead of waiting for the slow full-thread-list differential fetch.
        const currentAppUser = useStore.getState().appUser;
        if (currentAppUser && conversationsRef.current[key]) {
          try {
            const { updatedConversations, pubKeyPlusGroupName } =
              await getConversation(key, conversationsRef.current);
            if (selectedConversationPublicKeyRef.current === key) {
              setConversations((prev) => ({
                ...prev,
                [key]: updatedConversations[key],
              }));
              setPubKeyPlusGroupName(pubKeyPlusGroupName);
              if (updatedConversations[key]) {
                cacheConversationMessages(
                  currentAppUser.PublicKeyBase58Check,
                  key,
                  updatedConversations[key].messages
                );
              }
            }
          } catch (e) {
            console.error("[ChatOn] Notification thread fetch failed:", e);
          }
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  // advanced-event-handler-refs: store handler in ref so the listener
  // doesn't re-register when handleWsNewMessage changes.
  const visibilityHandlerRef = useRef(handleWsNewMessage);
  visibilityHandlerRef.current = handleWsNewMessage;
  const loadingRef = useRef(conversationsLoading);
  loadingRef.current = conversationsLoading;
  const isIdleRef = useRef(isIdle);
  isIdleRef.current = isIdle;
  const wsConnectedRef = useRef(wsConnected);
  wsConnectedRef.current = wsConnected;

  // Refresh conversations + classification data when PWA resumes from background
  useEffect(() => {
    if (!appUser) return;
    const publicKey = appUser.PublicKeyBase58Check;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !loadingRef.current) {
        // Check if a notification click wrote a pending conversation to IndexedDB.
        // postMessage from the SW is unreliable when the app is resuming from a
        // suspended/frozen state, so IndexedDB acts as the durable fallback.
        consumePendingNotificationConversation().then(async (pendingKey) => {
          if (pendingKey) {
            setSelectedConversationPublicKey(pendingKey);
            clearUnread(pendingKey);
            // Directly fetch the thread (fast paginated endpoint) so the new
            // message appears immediately instead of waiting for the slow
            // full-thread-list differential fetch below.
            if (conversationsRef.current[pendingKey]) {
              try {
                const { updatedConversations, pubKeyPlusGroupName } =
                  await getConversation(pendingKey, conversationsRef.current);
                if (selectedConversationPublicKeyRef.current === pendingKey) {
                  setConversations((prev) => ({
                    ...prev,
                    [pendingKey]: updatedConversations[pendingKey],
                  }));
                  setPubKeyPlusGroupName(pubKeyPlusGroupName);
                  if (updatedConversations[pendingKey]) {
                    cacheConversationMessages(
                      publicKey,
                      pendingKey,
                      updatedConversations[pendingKey].messages
                    );
                  }
                }
              } catch {
                // Fall through to the differential fetch below
              }
            }
          }
        });

        // Debounce: skip if another resume happened within 2s (rapid tab switching)
        const now = Date.now();
        if (now - lastResumeRef.current < FOREGROUND_RESUME_DEBOUNCE_MS) return;
        lastResumeRef.current = now;

        // Reset polling backoff on foreground resume — but keep the slow
        // rate if WS is connected (it handles real-time delivery).
        if (!wsConnectedRef.current) {
          setPollingDelay(baseDelay);
        }

        // Refresh conversations (existing behavior)
        visibilityHandlerRef.current("", "");

        // Silently re-fetch classification data (associations, follows) so
        // accept/block/dismiss actions from other devices sync without reload.
        Promise.all([
          fetchFollowedUsers(publicKey),
          fetchChatAssociations(publicKey),
          fetchArchivedGroups(publicKey),
        ])
          .then(([mutual, assoc, archivedMap]) => {
            const approvedSet = new Set(assoc.approved.keys());
            const blockedSet = new Set(assoc.blocked.keys());
            const archivedSet = new Set(archivedMap.keys());
            const archivedChatsSet = new Set(assoc.archivedChats.keys());
            const dismissedSet = new Set(assoc.dismissed.keys());
            setClassificationData(
              mutual,
              approvedSet,
              blockedSet,
              assoc.approved,
              assoc.blocked,
              archivedSet,
              archivedMap,
              archivedChatsSet,
              assoc.archivedChats,
              dismissedSet,
              assoc.dismissed
            );
          })
          .catch(() => {});

        // Refresh join request counts for owned groups
        fetchJoinRequestCountsForOwner(publicKey)
          .then(setJoinRequestCounts)
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [appUser]);

  useEffect(() => {
    setLockRefresh(isLoadingUser);
    // Only blank the screen during initial login (no conversations yet).
    // During same-user re-auth (derived key upgrade), conversations are
    // already visible — don't reset selection or show loading spinner.
    const hasConversations = Object.keys(conversations).length > 0;
    if (!hasConversations) {
      setSelectedConversationPublicKey("");
    }
  }, [isLoadingUser, appUser]);

  useEffect(() => {
    if (conversations[selectedConversationPublicKey]) {
      const chatName = getChatNameFromConversation(
        conversations[selectedConversationPublicKey],
        usernameByPublicKeyBase58Check,
        allAccessGroups
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
    allAccessGroups,
  ]);

  useInterval(async () => {
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
      const {
        conversations,
        updatedAllAccessGroups,
        publicKeyToProfileEntryResponseMap: pollProfiles,
      } = await getConversationsDifferential(
        appUser.PublicKeyBase58Check,
        allAccessGroups
      );
      setAllAccessGroups(updatedAllAccessGroups);

      // Update username + profile pic maps from fresh profile data
      const pollUsernames: Record<string, string> = {};
      const pollPics: Record<string, string> = {};
      for (const [pk, profile] of Object.entries(pollProfiles)) {
        if (profile?.Username) pollUsernames[pk] = profile.Username;
        const ed = profile?.ExtraData;
        if (ed) {
          const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
          if (picUrl) pollPics[pk] = picUrl;
        }
      }
      if (Object.keys(pollUsernames).length) {
        mergeUsernames(pollUsernames);
      }
      if (Object.keys(pollPics).length) {
        setProfilePicByPublicKey((s) => ({ ...s, ...pollPics }));
      }
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
      // Only back off when WS is disconnected — when connected, the
      // wsConnected effect already holds us at the slow safety-net rate.
      if (!wsConnectedRef.current) {
        setPollingDelay((prev) =>
          prev
            ? Math.min(prev + baseDelay, REFRESH_MESSAGES_MAX_INTERVAL_MS)
            : prev
        );
      }
    }
  }, pollingDelay);

  const fetchUsersStateless = async (newPublicKeysToGet: Array<string>) => {
    // Use the ref (always current) instead of state (stale in async callbacks)
    const known = usernameMapRef.current;
    const diff = newPublicKeysToGet.filter((k) => !(k in known));

    if (diff.length === 0) {
      return Promise.resolve(known);
    }

    return getUsersStateless({
      PublicKeysBase58Check: diff,
      SkipForLeaderboard: true,
    }).then((usersStatelessResponse) => {
      const newPublicKeyToUsernames: { [k: string]: string } = {};

      (usersStatelessResponse.UserList || []).forEach((u) => {
        newPublicKeyToUsernames[u.PublicKeyBase58Check] =
          u.ProfileEntryResponse?.Username || "";
      });

      mergeUsernames(newPublicKeyToUsernames);
      return usernameMapRef.current;
    });
  };

  const fetchGroupMembers = async (conversation: Conversation) => {
    if (conversation.ChatType !== ChatType.GROUPCHAT) {
      return;
    }

    const firstMsg = conversation.messages[0];
    if (!firstMsg) return; // No messages yet (e.g. user just joined)

    const { AccessGroupKeyName, OwnerPublicKeyBase58Check } =
      firstMsg.RecipientInfo;

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
    if (
      ownerProfile &&
      !PublicKeyToProfileEntryResponse[OwnerPublicKeyBase58Check]
    ) {
      PublicKeyToProfileEntryResponse[OwnerPublicKeyBase58Check] = ownerProfile;
    }

    setMembersByGroupKey((state) => ({
      ...state,
      [`${OwnerPublicKeyBase58Check}${AccessGroupKeyName}`]:
        PublicKeyToProfileEntryResponse,
    }));
    const usernamesByPublicKeyFromGroup: Record<string, string> = {};
    const groupProfilePics: Record<string, string> = {};
    Object.entries(PublicKeyToProfileEntryResponse || {}).forEach(
      ([pk, profile]) => {
        usernamesByPublicKeyFromGroup[pk] = profile?.Username || "";
        const ed = profile?.ExtraData;
        if (ed) {
          const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
          if (picUrl) groupProfilePics[pk] = picUrl;
        }
      }
    );
    mergeUsernames(usernamesByPublicKeyFromGroup);
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
      setConversationsLoading(false);
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
          cachedClassification.followedUsers,
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
        mergeUsernames(cachedUsernames);
      }

      const cachedKeyToUse =
        selectedKey ||
        (!userChange && selectedConversationPublicKey) ||
        cachedLastKey ||
        Object.keys(cachedConvos)[0];

      setConversations(cachedConvos);
      setConversationsLoading(false);

      renderedFromCache = true;

      if (selectConversation && cachedKeyToUse) {
        // Capture the last-read timestamp before selecting, for the unread divider
        const lastReadTs = getCachedLastReadTimestamps(publicKey);
        setOpenedLastReadNanos(lastReadTs[cachedKeyToUse] ?? null);

        setSelectedConversationPublicKey(cachedKeyToUse);
        setPubKeyPlusGroupName(cachedKeyToUse);
      }

      // Try to show cached messages for the selected conversation
      if (cachedKeyToUse && cachedConvos[cachedKeyToUse]) {
        const cachedMsgs = await getCachedConversationMessages(
          publicKey,
          cachedKeyToUse
        );
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

      // Eagerly refresh the selected conversation via the fast paginated
      // endpoint so new messages appear immediately, instead of waiting for
      // the slow full-thread-list revalidation below.
      if (cachedKeyToUse && cachedConvos[cachedKeyToUse]) {
        getConversation(cachedKeyToUse, cachedConvos)
          .then(({ updatedConversations, pubKeyPlusGroupName }) => {
            if (selectedConversationPublicKeyRef.current !== cachedKeyToUse)
              return;
            setConversations((prev) => ({
              ...prev,
              [cachedKeyToUse]: updatedConversations[cachedKeyToUse],
            }));
            setPubKeyPlusGroupName(pubKeyPlusGroupName);
            cacheConversationMessages(
              publicKey,
              cachedKeyToUse,
              updatedConversations[cachedKeyToUse].messages
            );
          })
          .catch(() => {});
      }

      // Restore unread badges from cached data immediately so badges don't
      // flash away and reappear when the user reopens the app. The last-read
      // timestamps are in localStorage, and cached conversations have the
      // latest message timestamps — everything needed to compute badges.
      const cachedLastRead = getCachedLastReadTimestamps(publicKey);
      const {
        mutedConversations: cachedMuted,
        archivedGroups: cachedArchived,
      } = useStore.getState();
      const cachedUnreadMap = new Map<string, number>();
      for (const [k, convo] of Object.entries(cachedConvos)) {
        if (k === cachedKeyToUse) continue;
        if (cachedMuted.has(k) || cachedArchived.has(k)) continue;
        const msgTs = latestIncomingTimestamp(convo);
        if (!msgTs) continue;
        const lastRead = cachedLastRead[k];
        if (lastRead !== undefined && msgTs > lastRead) {
          cachedUnreadMap.set(k, 1);
        }
      }
      if (cachedUnreadMap.size > 0) {
        initializeUnread(cachedUnreadMap);
      }
    }

    // --- Classification + privacy (always run in parallel) ---
    const classificationPromise = !chatRequestsLoaded
      ? Promise.all([
          fetchFollowedUsers(publicKey),
          fetchChatAssociations(publicKey),
          fetchArchivedGroups(publicKey),
        ])
          .then(([mutual, assoc, archivedMap]) => {
            const approvedSet = new Set(assoc.approved.keys());
            const blockedSet = new Set(assoc.blocked.keys());
            const archivedSet = new Set(archivedMap.keys());
            const archivedChatsSet = new Set(assoc.archivedChats.keys());
            const dismissedSet = new Set(assoc.dismissed.keys());
            setClassificationData(
              mutual,
              approvedSet,
              blockedSet,
              assoc.approved,
              assoc.blocked,
              archivedSet,
              archivedMap,
              archivedChatsSet,
              assoc.archivedChats,
              dismissedSet,
              assoc.dismissed
            );
          })
          .catch((e) => {
            console.error(
              "Failed to load chat request classification data:",
              e
            );
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

    // --- Conversation loading: progressive for first load, blocking for cache revalidation ---
    let conversationResult;

    // AbortController for progressive decryption — cancelled on logout/re-login
    const decryptAbort = new AbortController();

    if (!renderedFromCache) {
      // ── Progressive path: show shells immediately, decrypt in batches ──
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        const [rawResult] = await Promise.all([
          fetchMessageThreadsRaw(
            publicKey,
            (partial) => {
              // Bail if user logged out while the request was in flight
              if (decryptAbort.signal.aborted) return;
              // Whichever resolves first (DMs or groups) — render shells immediately
              const { conversations: partialShells } = buildShellConversations(
                partial.messageThreads,
                publicKey
              );
              if (Object.keys(partialShells).length > 0) {
                setConversations((prev) => ({ ...prev, ...partialShells }));
                setConversationsLoading(false);
              }
              // Extract usernames/pics from partial profile data
              const usernames: Record<string, string> = {};
              const pics: Record<string, string> = {};
              for (const [pk, profile] of Object.entries(
                partial.publicKeyToProfileEntryResponseMap
              )) {
                if (profile?.Username) usernames[pk] = profile.Username;
                const ed = profile?.ExtraData;
                if (ed) {
                  const pic = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
                  if (pic) pics[pk] = pic;
                }
              }
              if (Object.keys(usernames).length) mergeUsernames(usernames);
              if (Object.keys(pics).length)
                setProfilePicByPublicKey((s) => ({ ...s, ...pics }));
            },
            true /* useTimeout */
          ),
          classificationPromise,
          privacyPromise,
        ]);

        let { messageThreads } = rawResult;
        const { publicKeyToProfileEntryResponseMap } = rawResult;

        // Cap at 1000 threads for extreme cases — sort by recency so
        // the most recent conversations are kept. Prevents React from
        // managing thousands of conversation objects in state.
        const MAX_INITIAL_THREADS = 1000;
        if (messageThreads.length > MAX_INITIAL_THREADS) {
          messageThreads = [...messageThreads]
            .sort(
              (a, b) =>
                b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
            )
            .slice(0, MAX_INITIAL_THREADS);
        }

        if (messageThreads.length === 0) {
          // No threads — show empty state immediately instead of blocking
          // on auto-first-message + blockchain confirmation (was 30-60s).
          // The conversation appears in the background once confirmed.
          setConversations({});
          setConversationsLoading(false);

          // Fire-and-forget: send welcome message, merge when confirmed.
          // Guard against double-sends (e.g., StrictMode, rapid remount).
          if (welcomeMessageSentRef.current) return;
          welcomeMessageSentRef.current = true;
          getConversations(publicKey, allAccessGroups)
            .then((result) => {
              if (
                !result.conversations ||
                Object.keys(result.conversations).length === 0
              )
                return;
              // Bail if user logged out or switched accounts
              const currentUser = useStore.getState().appUser;
              if (currentUser?.PublicKeyBase58Check !== publicKey) return;

              setConversations((prev) => {
                // If user already started a conversation, merge — don't overwrite
                if (Object.keys(prev).length > 0) {
                  return { ...result.conversations, ...prev };
                }
                return result.conversations;
              });
              setAllAccessGroups(result.updatedAllAccessGroups);

              const profileMap = result.publicKeyToProfileEntryResponseMap;
              const usernames: Record<string, string> = {};
              for (const [pk, profile] of Object.entries(profileMap)) {
                if (profile?.Username) usernames[pk] = profile.Username;
              }
              if (Object.keys(usernames).length) mergeUsernames(usernames);
            })
            .catch((e) => {
              console.error(
                "[ChatOn] Background auto-first-message failed:",
                e
              );
            });

          return;
        } else {
          // Build shell conversations and show them immediately.
          // Also get latestByKey to pass directly to decryptConversationPreviews.
          const { conversations: shellConversations, latestByKey } =
            buildShellConversations(messageThreads, publicKey);

          // Separate local tracker from React state to avoid mutating state directly
          const localTracker: ConversationMap = { ...shellConversations };

          // Extract usernames and profile pics (available without decryption)
          const publicKeyToUsername: { [k: string]: string } = {};
          const profilePicUrls: { [k: string]: string } = {};
          Object.entries(publicKeyToProfileEntryResponseMap).forEach(
            ([pk, profileEntryResponse]) => {
              publicKeyToUsername[pk] = profileEntryResponse?.Username || "";
              const ed = profileEntryResponse?.ExtraData;
              if (ed) {
                const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
                if (picUrl) profilePicUrls[pk] = picUrl;
              }
            }
          );
          mergeUsernames(publicKeyToUsername);
          setProfilePicByPublicKey((state) => ({
            ...state,
            ...profilePicUrls,
          }));

          // Show conversation list with shimmer previews — clears the loading skeleton
          setConversations(shellConversations);
          setConversationsLoading(false);

          const shellKeyToUse =
            selectedKey ||
            (!userChange && selectedConversationPublicKey) ||
            Object.keys(shellConversations)[0];
          if (
            selectConversation &&
            shellKeyToUse &&
            (!selectedConversationPublicKeyRef.current ||
              selectedConversationPublicKeyRef.current === shellKeyToUse)
          ) {
            setSelectedConversationPublicKey(shellKeyToUse);
          }

          // Decrypt previews progressively in batches.
          // Updates go to localTracker (for conversationResult) AND React state (for UI).
          // Debounce React state updates: accumulate batch results and flush every 150ms
          // to avoid 50+ re-renders during initial load.
          let pendingUpdates = new Map<string, DecryptedMessageEntryResponse>();

          const flushPendingUpdates = () => {
            if (pendingUpdates.size === 0) return;
            const toFlush = pendingUpdates;
            pendingUpdates = new Map();
            setConversations((prev) => {
              const merged = { ...prev };
              for (const [key, decryptedMsg] of toFlush) {
                if (merged[key] && merged[key].messages.length > 0) {
                  merged[key] = {
                    ...merged[key],
                    messages: [decryptedMsg, ...merged[key].messages.slice(1)],
                  };
                }
              }
              return merged;
            });
          };

          const updatedAccessGroups = await decryptConversationPreviews(
            latestByKey,
            publicKey,
            allAccessGroups,
            (batchUpdates) => {
              // Update local tracker (never shared with React state)
              for (const [key, decryptedMsg] of batchUpdates) {
                if (
                  localTracker[key] &&
                  localTracker[key].messages.length > 0
                ) {
                  localTracker[key] = {
                    ...localTracker[key],
                    messages: [
                      decryptedMsg,
                      ...localTracker[key].messages.slice(1),
                    ],
                  };
                }
              }
              // Accumulate for debounced React state update
              for (const [key, msg] of batchUpdates) {
                pendingUpdates.set(key, msg);
              }
              if (flushTimer) clearTimeout(flushTimer);
              flushTimer = setTimeout(flushPendingUpdates, 150);
            },
            decryptAbort.signal
          );
          // Flush any remaining accumulated updates
          if (flushTimer) clearTimeout(flushTimer);
          flushPendingUpdates();
          setAllAccessGroups(updatedAccessGroups);

          // Fetch group members and DM usernames now that we have data
          const DMChats = Object.values(localTracker).filter(
            (e) => e.ChatType === ChatType.DM
          );
          const GroupChats = Object.values(localTracker).filter(
            (e) => e.ChatType === ChatType.GROUPCHAT
          );
          try {
            await Promise.all([
              updateUsernameToPublicKeyMapFromConversations(DMChats),
              ...GroupChats.map((e) => fetchGroupMembers(e)),
            ]);
          } catch (e) {
            console.error(
              "[ChatOn] Failed to fetch group members/usernames:",
              e
            );
          }
          cacheUsernameMap(publicKey, usernameMapRef.current);

          // Fire-and-forget cleanup
          cleanupOwnJoinRequests(publicKey, updatedAccessGroups).catch(
            () => {}
          );
          fetchJoinRequestCountsForOwner(publicKey)
            .then(setJoinRequestCounts)
            .catch(() => {});

          // Now load the full thread for the selected conversation
          setLoadingConversation(true);
          conversationResult = {
            conversations: localTracker,
            publicKeyToProfileEntryResponseMap,
            updatedAllAccessGroups: updatedAccessGroups,
          };
        }
      } catch (e) {
        decryptAbort.abort();
        // Clear debounced flush timer to prevent stale state writes
        if (flushTimer) clearTimeout(flushTimer);
        console.error("[ChatOn] Failed to fetch conversations:", e);
        setConversationsLoading(false);

        setConversationsError(
          e instanceof Error && e.message.includes("timed out")
            ? "Loading timed out — your messages are safe on-chain."
            : "Couldn't load conversations."
        );
        return;
      }
    } else {
      // ── Cache revalidation path: full blocking load in background ──
      const conversationPromise = getConversations(publicKey, allAccessGroups);
      try {
        [conversationResult] = await Promise.all([
          conversationPromise,
          classificationPromise,
          privacyPromise,
        ]);
      } catch (e) {
        console.error("[ChatOn] Failed to fetch conversations:", e);
        setConversationsLoading(false);

        return;
      }
    }

    const {
      conversations: freshConversations,
      publicKeyToProfileEntryResponseMap: profileMap,
      updatedAllAccessGroups,
    } = conversationResult;
    setAllAccessGroups(updatedAllAccessGroups);

    if (renderedFromCache) {
      // These only need to run on the cache-revalidation path;
      // the progressive path handles them inline above
      cleanupOwnJoinRequests(publicKey, updatedAllAccessGroups).catch(() => {});
      fetchJoinRequestCountsForOwner(publicKey)
        .then(setJoinRequestCounts)
        .catch(() => {});
    }

    let conversationsResponse = freshConversations || {};
    const keyToUse =
      selectedKey ||
      (!userChange && selectedConversationPublicKey) ||
      Object.keys(conversationsResponse)[0];

    if (keyToUse && !conversationsResponse[keyToUse]) {
      const isGroup = keyToUse.length > PUBLIC_KEY_LENGTH;
      conversationsResponse = {
        [keyToUse]: {
          ChatType: isGroup ? ChatType.GROUPCHAT : ChatType.DM,
          firstMessagePublicKey: keyToUse.slice(0, PUBLIC_KEY_LENGTH),
          messages: [],
        },
        ...conversationsResponse,
      };
    }

    if (renderedFromCache) {
      const DMChats = Object.values(conversationsResponse).filter(
        (e) => e.ChatType === ChatType.DM
      );
      const GroupChats = Object.values(conversationsResponse).filter(
        (e) => e.ChatType === ChatType.GROUPCHAT
      );

      const publicKeyToUsername: { [k: string]: string } = {};
      const profilePicUrls: { [k: string]: string } = {};
      Object.entries(profileMap).forEach(([pk, profileEntryResponse]) => {
        publicKeyToUsername[pk] = profileEntryResponse?.Username || "";
        const ed = profileEntryResponse?.ExtraData;
        if (ed) {
          const picUrl = ed.NFTProfilePictureUrl || ed.LargeProfilePicURL;
          if (picUrl) profilePicUrls[pk] = picUrl;
        }
      });
      mergeUsernames(publicKeyToUsername);
      setProfilePicByPublicKey((state) => ({
        ...state,
        ...profilePicUrls,
      }));
      try {
        await Promise.all([
          updateUsernameToPublicKeyMapFromConversations(DMChats),
          ...GroupChats.map((e) => fetchGroupMembers(e)),
        ]);
      } catch (e) {
        console.error("[ChatOn] Failed to fetch group members/usernames:", e);
      }
      cacheUsernameMap(publicKey, usernameMapRef.current);
    }

    // Only force-select if user hasn't already navigated to a different conversation
    if (
      selectConversation &&
      (!selectedConversationPublicKeyRef.current ||
        selectedConversationPublicKeyRef.current === keyToUse)
    ) {
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
            const optimistic = merged[k].messages.filter(
              (m: any) => m._localId && m._status !== "sent"
            );
            merged[k] = convo;
            if (optimistic.length > 0) {
              merged[k] = {
                ...merged[k],
                messages: [...optimistic, ...merged[k].messages],
              };
            }
          }
        }
        // Remove conversations no longer returned by the blockchain
        // (e.g. user was removed from a group) — but keep the one the user is viewing.
        // Only do this on the cache-revalidation path; on the progressive path
        // updatedConversations is the shell set which may be missing conversations
        // that arrived via WebSocket during decryption.
        if (renderedFromCache) {
          for (const k of Object.keys(merged)) {
            if (!updatedConversations[k] && k !== currentKey) {
              delete merged[k];
            }
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
      const { mutedConversations: muted, archivedGroups: archived } =
        useStore.getState();
      const unreadMap = new Map<string, number>();
      for (const [k, convo] of Object.entries(conversationsResponse)) {
        if (k === keyToUse) continue; // Currently selected conversation
        if (muted.has(k) || archived.has(k)) continue; // Skip muted/archived
        const msgTs = latestIncomingTimestamp(convo);
        if (!msgTs) continue; // No incoming messages
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
        navigator.clearAppBadge?.()?.catch?.(() => {});
      }
      // Mark the selected conversation as read
      if (keyToUse) {
        const selectedConvo = conversationsResponse[keyToUse];
        if (selectedConvo?.messages[0]) {
          cacheLastReadTimestamp(
            publicKey,
            keyToUse,
            selectedConvo.messages[0].MessageInfo.TimestampNanos
          );
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
      if (
        !selectedConversationPublicKeyRef.current ||
        selectedConversationPublicKeyRef.current === keyToUse
      ) {
        setLoadingConversation(false);
      }
      setConversationsLoading(false);
    }

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
      if (!convo || convo.length === 0) {
        return {
          updatedConversations: currentConversations,
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
      activeChatUsersMap,
      allAccessGroups
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

    setConversationsLoading(true);
    setConversationsError(null);
    rehydrateConversation(pending || "", false, !isMobile || !!pending);
  }, [appUser, isMobile, rehydrateConversation]);

  const conversationsReady = Object.keys(conversations).length > 0;
  // Guard: if the selected key doesn't match any conversation (e.g. stale
  // cache, race condition during hydration), use a safe key for THIS render
  // and schedule a state update for the next. Prevents crashes from bare
  // `selectedConversation.property` accesses deep in the JSX tree.
  let safeSelectedKey = selectedConversationPublicKey;
  if (
    conversationsReady &&
    safeSelectedKey &&
    !conversations[safeSelectedKey]
  ) {
    safeSelectedKey = Object.keys(conversations)[0] || "";
    setSelectedConversationPublicKey(safeSelectedKey);
  }
  const selectedConversation = conversations[safeSelectedKey];
  const isGroupChat = selectedConversation?.ChatType === ChatType.GROUPCHAT;
  const isChatOwner =
    isGroupChat &&
    appUser &&
    selectedConversation?.messages[0]?.RecipientInfo
      ?.OwnerPublicKeyBase58Check === appUser.PublicKeyBase58Check;
  const isGroupOwner = isGroupChat && isChatOwner;
  const selectedGroupImageUrl =
    isGroupChat && selectedConversation?.messages[0]
      ? getGroupImageUrl(
          allAccessGroups,
          selectedConversation.messages[0].RecipientInfo
            .OwnerPublicKeyBase58Check,
          selectedConversation.messages[0].RecipientInfo.AccessGroupKeyName
        )
      : undefined;
  const chatMembers = membersByGroupKey[selectedConversationPublicKey];

  // Fetch presence data when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) return;
    if (isGroupChat) {
      if (chatMembers) {
        fetchPresenceForKeys(Object.keys(chatMembers));
      }
    } else if (selectedConversation.firstMessagePublicKey) {
      fetchPresenceForKeys([selectedConversation.firstMessagePublicKey]);
    }
  }, [
    safeSelectedKey,
    isGroupChat,
    chatMembers,
    fetchPresenceForKeys,
    selectedConversation,
  ]);

  const activeChatUsersMap: { [k: string]: string } = isGroupChat
    ? Object.keys(chatMembers || {}).reduce<{ [k: string]: string }>(
        (acc, curr) => ({
          ...acc,
          [curr]:
            chatMembers[curr]?.Username ||
            usernameByPublicKeyBase58Check[curr] ||
            "",
        }),
        { ...usernameByPublicKeyBase58Check }
      )
    : usernameByPublicKeyBase58Check;

  // For group chats, notify ALL members (relay skips the sender).
  // For DMs, notify just the other participant.
  // Always resolves the sender's username from available sources so callers don't need to pass it.
  const notifyConversation = (
    convKey: string,
    dmRecipient: string,
    fromUsername?: string
  ) => {
    const resolvedUsername =
      fromUsername ||
      usernameByPublicKeyBase58Check[appUser?.PublicKeyBase58Check ?? ""] ||
      appUser?.ProfileEntryResponse?.Username ||
      appUser?.PublicKeyBase58Check ||
      "Someone";
    const conv = conversations[convKey];
    const members = membersByGroupKey[convKey];
    if (conv?.ChatType === ChatType.GROUPCHAT && members) {
      const recipientInfo = conv.messages[0]?.RecipientInfo;
      const groupKeyName = recipientInfo?.AccessGroupKeyName;
      // Resolve human-readable display name for notification title
      const groupName =
        getGroupDisplayName(
          allAccessGroups,
          recipientInfo?.OwnerPublicKeyBase58Check,
          groupKeyName
        ) || groupKeyName?.replace(/\0/g, "");
      sendNotify(convKey, Object.keys(members), resolvedUsername, groupName);
    } else {
      sendNotify(convKey, [dmRecipient], resolvedUsername);
    }
  };
  return (
    <div className="h-full">
      {/* Onboarding wizard for new users */}
      {showOnboarding &&
        appUser &&
        hasSetupMessaging(appUser) &&
        !isLoadingUser && (
          <div className="h-full overflow-y-auto">
            <OnboardingWizard onComplete={handleOnboardingComplete} />
          </div>
        )}

      {/* Loading / setup states (non-onboarding) */}
      {!showOnboarding && (!hasSetupMessaging(appUser) || isLoadingUser) && (
        <div className="m-auto relative top-8 overflow-hidden pt-[30px] pb-[50px]">
          <div className="bg-gradient"></div>
          <div className="w-full lg:max-w-[1200px] m-auto bg-transparent p-0 shadow-none">
            <div>
              {isLoadingUser && (
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
                  <Loader2 className="w-11 h-11 animate-spin text-[#34F080]" />
                </div>
              )}
              {!hasSetupMessaging(appUser) && !isLoadingUser && (
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
                            Chat with anyone, on DeSo or Ethereum. Without the
                            risk of being censored.
                          </h2>
                          <p className="text-sm mb-5 text-gray-400">
                            DeSo Chat Protocol is a censorship-resistant
                            messaging protocol built on top of the DeSo
                            blockchain. It enables fully decentralized
                            cross-chain messaging between DeSo and Ethereum
                            wallets (and soon, Solana).
                          </p>
                          <p className="text-sm mb-5 text-gray-400">
                            This is possible due to DeSo's infinite-state
                            blockchain & derived keys cryptography.
                          </p>
                          <p className="text-sm mb-5 text-gray-400">
                            Messages are stored directly on-chain, at an average
                            cost of ~$0.000002 (<em>basically free</em>), with
                            end-to-end encryption, and support for DMs & group
                            chats — including fully on-chain social, identity,
                            creator coins, tokens & NFTs.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6 text-[#34F080]">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> E2EE messages &
                        group chats
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> 100% on-chain (fully
                        synced)
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Sign in with DeSo &
                        MetaMask
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Message DeSo &
                        Ethereum wallets
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Open-source & built
                        on DeSo
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> On-chain social,
                        identity & assets
                      </div>
                    </div>
                    <MessagingSetupButton />
                    <p className="mt-5 text-sm mb-5 text-blue-300/40">
                      This project is fully open-sourced for developers to fork
                      & build on top of. You can add features like ENS support,
                      NFT profile pictures, message tipping, paid DMs,
                      token-gated group chats and more. Visit&nbsp;
                      <a
                        target="_blank"
                        className="underline text-blue-300/40 hover:text-blue-300"
                        href="https://github.com/sungkhum/chaton"
                        rel="noreferrer"
                      >
                        Github Repository &rarr;
                      </a>{" "}
                      or&nbsp;
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

              {hasSetupMessaging(appUser) && !isLoadingUser && (
                <MessagingConversationButton onClick={rehydrateConversation} />
              )}
            </div>
          </div>
        </div>
      )}
      {!showOnboarding &&
        hasSetupMessaging(appUser) &&
        appUser &&
        !isLoadingUser && (
          <div className="flex h-full">
            <div className="w-full md:w-[340px] lg:w-[380px] xl:w-[420px] border-r border-white/5 bg-[#080d16] shrink-0">
              <MessagingConversationAccount
                rehydrateConversation={rehydrateConversation}
                conversationsLoading={conversationsLoading}
                conversationsError={conversationsError}
                onRetryLoad={() => {
                  setConversationsError(null);
                  setConversationsLoading(true);
                  rehydrateConversation();
                }}
                onClick={async (key: string) => {
                  if (key === selectedConversationPublicKey) {
                    // Still clear unread badge if a message arrived while viewing
                    if (unreadByConversation.has(key)) {
                      clearUnread(key);
                      removeUnreadConversation(key);
                      const ts =
                        conversations[key]?.messages[0]?.MessageInfo
                          ?.TimestampNanos;
                      sendRead(key, ts ? String(ts) : undefined);
                      if (appUser && ts) {
                        cacheLastReadTimestamp(
                          appUser.PublicKeyBase58Check,
                          key,
                          ts
                        );
                      }
                    }
                    return;
                  }
                  // Capture the last-read timestamp BEFORE updating it,
                  // so MessagingBubblesAndAvatar can show the "new messages" divider.
                  if (appUser) {
                    const timestamps = getCachedLastReadTimestamps(
                      appUser.PublicKeyBase58Check
                    );
                    setOpenedLastReadNanos(timestamps[key] ?? null);
                  } else {
                    setOpenedLastReadNanos(null);
                  }

                  setSelectedConversationPublicKey(key);
                  setPubKeyPlusGroupName(key);
                  setLoadingConversation(true);
                  setEditingMessage(null);
                  setReplyToMessage(null);
                  clearUnread(key);
                  removeUnreadConversation(key);
                  {
                    const ts =
                      conversations[key]?.messages[0]?.MessageInfo
                        ?.TimestampNanos;
                    sendRead(key, ts ? String(ts) : undefined);
                    if (appUser && ts) {
                      cacheLastReadTimestamp(
                        appUser.PublicKeyBase58Check,
                        key,
                        ts
                      );
                    }
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
                    if (
                      cached &&
                      cached.length > 0 &&
                      key === selectedConversationPublicKeyRef.current
                    ) {
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
                highlightsByConversation={highlightsByConversation}
              />
            </div>

            <div
              className={`w-full h-full shrink-0 md:flex-1 md:min-w-0 bg-[#0a1019] md:ml-0 md:z-auto transition-[margin-left] duration-300 ease-in-out ${
                selectedConversationPublicKey ? "ml-[-100%] z-50" : ""
              }`}
            >
              <header className="flex justify-between items-center border-b border-white/5 relative px-4 md:px-5 h-14">
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
                      <div className="min-w-0">
                        <span className="text-white font-bold text-base truncate block">
                          {getCurrentChatName()}
                        </span>
                        {(() => {
                          if (isGroupChat) {
                            const memberKeys = chatMembers
                              ? Object.keys(chatMembers)
                              : [];
                            const online = getOnlineCount(memberKeys);
                            const total = memberKeys.length;
                            if (total === 0) return null;
                            return (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">
                                  {total} {total === 1 ? "member" : "members"}
                                </span>
                                {online > 0 && (
                                  <span className="flex items-center gap-1 text-[#34F080]/80">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#34F080] animate-pulse" />
                                    {online} online
                                  </span>
                                )}
                              </div>
                            );
                          }
                          const otherKey =
                            selectedConversation?.firstMessagePublicKey;
                          if (!otherKey) return null;
                          const presence = getPresence(otherKey);
                          if (presence.status === "online")
                            return (
                              <span className="flex items-center gap-1 text-[#34F080] text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#34F080] animate-pulse" />
                                Online
                              </span>
                            );
                          if (presence.status === "last-seen")
                            return (
                              <span className="text-gray-500 text-xs whitespace-nowrap">
                                {formatLastSeen(presence.timestamp)}
                              </span>
                            );
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                <div className="text-gray-400 items-center hidden md:block">
                  {isGroupChat
                    ? (() => {
                        const memberKeys = chatMembers
                          ? Object.keys(chatMembers)
                          : [];
                        const online = getOnlineCount(memberKeys);
                        const total = memberKeys.length;
                        if (total === 0) return null;
                        return (
                          <span className="text-gray-500 text-sm whitespace-nowrap inline-flex items-center gap-1">
                            {total} {total === 1 ? "member" : "members"}
                            {online > 0 && (
                              <>
                                {" "}
                                ·{" "}
                                <span className="w-1.5 h-1.5 rounded-full bg-[#34F080] animate-pulse inline-block" />
                                <span className="text-[#34F080]/80">
                                  {online} online
                                </span>
                              </>
                            )}
                          </span>
                        );
                      })()
                    : (() => {
                        const otherKey =
                          selectedConversation?.firstMessagePublicKey;
                        if (!otherKey) return null;
                        const presence = getPresence(otherKey);
                        if (presence.status === "online")
                          return (
                            <span className="flex items-center gap-1.5 text-[#34F080] text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#34F080] animate-pulse" />
                              Online
                            </span>
                          );
                        if (presence.status === "last-seen")
                          return (
                            <span className="text-gray-500 text-sm whitespace-nowrap">
                              {formatLastSeen(presence.timestamp)}
                            </span>
                          );
                        return null;
                      })()}
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
                        const wasMuted = mutedConversations.has(
                          selectedConversationPublicKey
                        );
                        toast(
                          wasMuted
                            ? "Notifications unmuted"
                            : "Notifications muted",
                          {
                            icon: wasMuted ? (
                              <Bell className="w-4 h-4" />
                            ) : (
                              <BellOff className="w-4 h-4" />
                            ),
                            duration: 2000,
                          }
                        );
                      }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                      title={
                        mutedConversations.has(selectedConversationPublicKey)
                          ? "Unmute notifications"
                          : "Mute notifications"
                      }
                    >
                      {mutedConversations.has(selectedConversationPublicKey) ? (
                        <BellOff className="w-5 h-5 text-gray-500" />
                      ) : (
                        <Bell className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  {isGroupChat ? (
                    <Suspense fallback={null}>
                      <LazyManageMembersDialog
                        conversation={selectedConversation}
                        conversationKey={selectedConversationPublicKey}
                        onSuccess={rehydrateConversation}
                        onLeaveGroup={handleArchiveGroup}
                        onOptimisticSystemMessage={
                          handleOptimisticSystemMessage
                        }
                        isGroupOwner={!!isGroupOwner}
                      />
                    </Suspense>
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
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setDmMenuOpen(false)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-[#141c2b] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]">
                                <button
                                  onClick={() => {
                                    setDmMenuOpen(false);
                                    setBlockConfirm({
                                      conversationKey:
                                        selectedConversationPublicKey,
                                      publicKey:
                                        selectedConversation.firstMessagePublicKey,
                                      name:
                                        activeChatUsersMap[
                                          selectedConversation
                                            .firstMessagePublicKey
                                        ] || "this user",
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

              <div className="pr-2 rounded-none w-[100%] bg-transparent ml-[calc-340px] pb-0 h-[calc(100%-56px)]">
                <div className="border-none flex flex-col h-full">
                  <div className="overflow-hidden flex-1 min-h-0">
                    {loadingConversation || !selectedConversation ? (
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
                        lastReadTimestampNanos={openedLastReadNanos}
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
                          sendInputRef.current?.focus();
                          const senderKey =
                            msg.SenderInfo.OwnerPublicKeyBase58Check;
                          startTransition(() => {
                            setEditingMessage(null);
                            setReplyToMessage({
                              text: msg.DecryptedMessage || "",
                              timestamp: msg.MessageInfo.TimestampNanosString,
                              sender:
                                activeChatUsersMap[senderKey] || senderKey,
                            });
                          });
                        }}
                        hiddenMessageIds={hiddenMessageIds}
                        pendingTipTimestamps={pendingTipTimestamps}
                        onEdit={(msg) => {
                          sendInputRef.current?.focus();
                          startTransition(() => {
                            setReplyToMessage(null);
                            setEditingMessage({
                              text: msg.DecryptedMessage || "",
                              timestamp: msg.MessageInfo.TimestampNanosString,
                            });
                          });
                        }}
                        onDeleteForMe={async (timestampNanosString) => {
                          if (!appUser) return;
                          setHiddenMessageIds((prev) => {
                            const next = new Set(prev);
                            next.add(timestampNanosString);
                            return next;
                          });
                          await hideMessage(
                            appUser.PublicKeyBase58Check,
                            timestampNanosString
                          );
                        }}
                        onDeleteForEveryone={async (message) => {
                          if (!appUser || !selectedConversation) return;
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
                          const timestampNanosString =
                            message.MessageInfo.TimestampNanosString;

                          // Save original for rollback
                          const originalMessage = message;

                          // Preserve existing ExtraData and add deleted flag
                          const existingExtraData =
                            message.MessageInfo?.ExtraData || {};
                          const deletedExtraData = {
                            ...existingExtraData,
                            "msg:deleted": "true",
                          };

                          // Optimistic: replace message with tombstone
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.map((m) =>
                                m.MessageInfo.TimestampNanosString ===
                                timestampNanosString
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
                            // No push notification for deletions
                          } catch {
                            toast.error(
                              "Failed to delete message for everyone"
                            );
                            // Rollback
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m) =>
                                  m.MessageInfo.TimestampNanosString ===
                                  timestampNanosString
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
                          const pendingMsgs = await getPendingMessages(
                            appUser.PublicKeyBase58Check
                          );
                          const pending = pendingMsgs.find(
                            (m) => m.localId === localId
                          );
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
                          removePendingMessage(
                            appUser.PublicKeyBase58Check,
                            localId
                          );
                        }}
                        onReact={async (
                          timestampNanosString,
                          emoji,
                          forceAction
                        ) => {
                          if (!appUser || !selectedConversation) return;
                          const myKey = appUser.PublicKeyBase58Check;
                          const convKey = selectedConversationPublicKey;

                          // Determine if this is an add or remove (toggle logic).
                          // Check if the user already has an active "add" reaction
                          // for this emoji on this message (last-write-wins).
                          let action: "add" | "remove" = forceAction || "add";
                          if (!forceAction) {
                            const msgs = selectedConversation.messages;
                            let latestTs = -1;
                            let latestAction: "add" | "remove" = "add";
                            for (const m of msgs) {
                              const p = parseMessageType(m);
                              if (
                                p.type === "reaction" &&
                                p.replyTo === timestampNanosString &&
                                p.emoji === emoji &&
                                m.SenderInfo.OwnerPublicKeyBase58Check === myKey
                              ) {
                                const ts = m.MessageInfo.TimestampNanos;
                                if (ts > latestTs) {
                                  latestTs = ts;
                                  latestAction = p.action || "add";
                                }
                              }
                            }
                            // If they already have an active "add", toggle to "remove"
                            if (latestTs > -1 && latestAction === "add") {
                              action = "remove";
                            }
                          }

                          // Debounce: skip if there's already a pending reaction
                          // for this same emoji+target combo
                          const msgs = selectedConversation.messages;
                          const hasPending = msgs.some(
                            (m: any) =>
                              m._status === "sending" &&
                              m._localId?.startsWith("local-reaction-") &&
                              m.MessageInfo?.ExtraData?.["msg:replyTo"] ===
                                timestampNanosString &&
                              m.MessageInfo?.ExtraData?.["msg:emoji"] === emoji
                          );
                          if (hasPending) return;

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
                          const reactedToMsg =
                            selectedConversation.messages.find(
                              (m) =>
                                m.MessageInfo.TimestampNanosString ===
                                timestampNanosString
                            );
                          const preview =
                            reactedToMsg?.DecryptedMessage?.slice(0, 30) || "";
                          const fallbackText =
                            action === "remove"
                              ? `Removed ${emoji} reaction`
                              : preview
                              ? `Reacted ${emoji} to "${preview}${
                                  (reactedToMsg?.DecryptedMessage?.length ??
                                    0) > 30
                                    ? "…"
                                    : ""
                                }"`
                              : `Reacted ${emoji}`;

                          // Optimistic: insert a mock reaction message immediately
                          const localId = `local-reaction-${Date.now()}-${Math.random()}`;
                          const TimestampNanos = new Date().getTime() * 1e6;
                          const mockReaction = {
                            DecryptedMessage: fallbackText,
                            IsSender: true,
                            _status: "sending" as const,
                            _localId: localId,
                            SenderInfo: {
                              OwnerPublicKeyBase58Check: myKey,
                              AccessGroupKeyName:
                                DEFAULT_KEY_MESSAGING_GROUP_NAME,
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
                                action,
                              }),
                            },
                          } as DecryptedMessageEntryResponse & {
                            _status: string;
                            _localId: string;
                          };

                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: [
                                mockReaction,
                                ...prev[convKey].messages,
                              ],
                            },
                          }));

                          try {
                            await encryptAndSendNewMessage(
                              fallbackText,
                              myKey,
                              recipientPublicKey,
                              recipientKeyName,
                              DEFAULT_KEY_MESSAGING_GROUP_NAME,
                              buildExtraData({
                                type: "reaction",
                                replyTo: timestampNanosString,
                                emoji,
                                action,
                              })
                            );
                            // Mark as sent
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m: any) =>
                                  m._localId === localId
                                    ? { ...m, _status: "sent" }
                                    : m
                                ),
                              },
                            }));
                          } catch {
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
                            toast.error(
                              action === "remove"
                                ? "Failed to remove reaction"
                                : "Failed to send reaction"
                            );
                          }
                        }}
                        onTip={(msg, amountUsd) => {
                          if (!appUser) return;
                          const senderPk =
                            msg.SenderInfo.OwnerPublicKeyBase58Check;
                          if (senderPk === appUser.PublicKeyBase58Check) {
                            toast.info("You can't tip yourself");
                            return;
                          }
                          const { blockedUsers, dismissedUsers } =
                            useStore.getState();
                          if (
                            blockedUsers.has(senderPk) ||
                            dismissedUsers.has(senderPk)
                          )
                            return;
                          setTipTarget({
                            recipientPublicKey: senderPk,
                            recipientUsername: activeChatUsersMap[senderPk],
                            tipReplyTo: msg.MessageInfo.TimestampNanosString,
                            initialAmountUsd: amountUsd,
                          });
                          setPendingTipTimestamps((prev) =>
                            new Set(prev).add(
                              msg.MessageInfo.TimestampNanosString
                            )
                          );
                        }}
                        onMicroTip={async (msg) => {
                          if (!appUser || !selectedConversation) return;
                          const senderPk =
                            msg.SenderInfo.OwnerPublicKeyBase58Check;
                          if (senderPk === appUser.PublicKeyBase58Check) {
                            toast.info("You can't tip yourself");
                            return;
                          }
                          const { blockedUsers, dismissedUsers } =
                            useStore.getState();
                          if (
                            blockedUsers.has(senderPk) ||
                            dismissedUsers.has(senderPk)
                          )
                            return;
                          // Cooldown check
                          const now = Date.now();
                          if (now - lastMicroTipTime < MICRO_TIP_COOLDOWN_MS) {
                            toast.info(
                              "Please wait a moment before sending another tip"
                            );
                            return;
                          }
                          lastMicroTipTime = now;
                          const tipTs = msg.MessageInfo.TimestampNanosString;
                          setPendingTipTimestamps((prev) =>
                            new Set(prev).add(tipTs)
                          );

                          try {
                            const tipCurrency =
                              (getCachedTipCurrency(
                                appUser.PublicKeyBase58Check
                              ) as TipCurrency) || "DESO";
                            let txHash = "";
                            let tipAmountNanos = 0;
                            let tipAmountUsdcBaseUnits: string | undefined;

                            if (tipCurrency === "USDC") {
                              const usdcAmount = usdToUsdcBaseUnits(0.01);
                              const balance = await fetchUsdcBalance(
                                appUser.PublicKeyBase58Check
                              );
                              if (balance < usdcAmount) {
                                toast.info("Insufficient USDC balance");
                                return;
                              }
                              if (appUser.BalanceNanos < 1e6) {
                                toast.info(
                                  "Need a small amount of DESO for fees"
                                );
                                return;
                              }

                              const hasPerms = identity.hasPermissions({
                                GlobalDESOLimit: 1e6,
                                DAOCoinOperationLimitMap: {
                                  [USDC_CREATOR_PUBLIC_KEY]: { transfer: 1 },
                                },
                              });
                              if (!hasPerms) {
                                await identity.requestPermissions({
                                  GlobalDESOLimit: 1e7,
                                  TransactionCountLimitMap: {
                                    AUTHORIZE_DERIVED_KEY: 1,
                                  },
                                  DAOCoinOperationLimitMap: {
                                    [USDC_CREATOR_PUBLIC_KEY]: { transfer: 1 },
                                  },
                                });
                              }
                              const result = await withAuth(() =>
                                transferDeSoToken({
                                  SenderPublicKeyBase58Check:
                                    appUser.PublicKeyBase58Check,
                                  ProfilePublicKeyBase58CheckOrUsername:
                                    USDC_CREATOR_PUBLIC_KEY,
                                  ReceiverPublicKeyBase58CheckOrUsername:
                                    senderPk,
                                  DAOCoinToTransferNanos:
                                    toHexUint256(usdcAmount),
                                  MinFeeRateNanosPerKB: 1000,
                                })
                              );
                              txHash =
                                (result as any)?.TxnHashHex ||
                                (result as any)?.TransactionIDBase58Check ||
                                "";
                              tipAmountUsdcBaseUnits = toHexUint256(usdcAmount);
                              invalidateUsdcBalanceCache();
                            } else {
                              if (appUser.BalanceNanos <= 0) {
                                toast.info("Add funds to send tips");
                                return;
                              }
                              const rate = await fetchExchangeRate();
                              tipAmountNanos = usdToNanos(0.01, rate);
                              if (tipAmountNanos <= 0) {
                                toast.error("Could not calculate tip amount");
                                return;
                              }
                              if (tipAmountNanos > appUser.BalanceNanos) {
                                toast.info("Insufficient balance");
                                return;
                              }

                              const hasPerms = identity.hasPermissions({
                                GlobalDESOLimit: tipAmountNanos,
                                TransactionCountLimitMap: { BASIC_TRANSFER: 1 },
                              });
                              if (!hasPerms) {
                                await identity.requestPermissions({
                                  GlobalDESOLimit: tipAmountNanos + 1e7,
                                  TransactionCountLimitMap: {
                                    AUTHORIZE_DERIVED_KEY: 1,
                                    BASIC_TRANSFER: 1,
                                  },
                                });
                              }
                              const result = await withAuth(() =>
                                sendDeso({
                                  SenderPublicKeyBase58Check:
                                    appUser.PublicKeyBase58Check,
                                  RecipientPublicKeyOrUsername: senderPk,
                                  AmountNanos: tipAmountNanos,
                                  MinFeeRateNanosPerKB: 1000,
                                })
                              );
                              txHash =
                                (result as any)?.TxnHashHex ||
                                (result as any)?.TransactionIDBase58Check ||
                                "";
                            }

                            // Send tip message
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

                            const senderUsername = activeChatUsersMap[senderPk];
                            const fallback = `Tipped $0.01 to ${
                              senderUsername
                                ? `@${senderUsername}`
                                : senderPk.slice(0, 8)
                            }`;

                            await encryptAndSendNewMessage(
                              fallback,
                              appUser.PublicKeyBase58Check,
                              recipientPublicKey,
                              recipientKeyName,
                              DEFAULT_KEY_MESSAGING_GROUP_NAME,
                              buildExtraData({
                                type: "tip",
                                tipAmountNanos:
                                  tipCurrency === "DESO"
                                    ? tipAmountNanos
                                    : undefined,
                                tipAmountUsdcBaseUnits,
                                tipCurrency,
                                tipTxHash: txHash,
                                tipReplyTo:
                                  msg.MessageInfo.TimestampNanosString,
                                tipRecipient: senderPk,
                              })
                            );
                            // No push notification for tips
                            useStore.getState().addSessionTipUsd(0.01);
                            toast.success(
                              `Tipped $0.01 ${tipCurrency} to ${
                                senderUsername ? `@${senderUsername}` : "user"
                              }`
                            );
                          } catch (error: any) {
                            const errMsg =
                              error?.message || error?.toString?.() || "";
                            if (
                              errMsg.includes("user cancelled") ||
                              errMsg.includes("WINDOW_CLOSED")
                            ) {
                              toast.error("Transaction cancelled.");
                            } else {
                              toast.error("Tip failed.");
                              console.error("Micro-tip error:", error);
                            }
                          } finally {
                            setPendingTipTimestamps((prev) => {
                              const next = new Set(prev);
                              next.delete(tipTs);
                              return next;
                            });
                          }
                        }}
                        onPrivateMessage={(senderPublicKey) => {
                          rehydrateConversation(
                            senderPublicKey + DEFAULT_KEY_MESSAGING_GROUP_NAME,
                            true
                          );
                        }}
                      />
                    )}
                  </div>

                  {selectedConversation && (
                    <SendMessageButtonAndInput
                      ref={sendInputRef}
                      key={selectedConversationPublicKey}
                      conversationKey={selectedConversationPublicKey}
                      replyTo={replyToMessage}
                      onCancelReply={() =>
                        startTransition(() => setReplyToMessage(null))
                      }
                      editingMessage={editingMessage}
                      onCancelEdit={() =>
                        startTransition(() => setEditingMessage(null))
                      }
                      onSubmitEdit={async (newText, timestamp) => {
                        if (
                          !appUser ||
                          !newText.trim() ||
                          !selectedConversation
                        )
                          return;
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
                        const originalMessage =
                          selectedConversation.messages.find(
                            (m) =>
                              m.MessageInfo.TimestampNanosString === timestamp
                          );

                        // Preserve existing ExtraData (e.g. reply info) and add edited flag
                        const existingExtraData =
                          originalMessage?.MessageInfo?.ExtraData || {};
                        const updatedExtraData = {
                          ...existingExtraData,
                          "msg:edited": "true",
                        };

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
                          // No push notification for edits
                        } catch {
                          toast.error("Failed to edit message");
                          // Rollback
                          if (originalMessage) {
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m) =>
                                  m.MessageInfo.TimestampNanosString ===
                                  timestamp
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
                      onKeystroke={() =>
                        onKeystroke(selectedConversationPublicKey)
                      }
                      typingUsers={getTypingUsersForConversation(
                        selectedConversationPublicKey
                      )
                        .map(
                          (pk) =>
                            usernameByPublicKeyBase58Check[pk] ||
                            shortenLongWord(pk)
                        )
                        .filter(Boolean)}
                      mentionCandidates={
                        isGroupChat && chatMembers
                          ? Object.entries(chatMembers)
                              .filter(
                                ([pk, profile]) =>
                                  pk !== appUser?.PublicKeyBase58Check &&
                                  profile?.Username
                              )
                              .map(([pk, profile]) => ({
                                publicKey: pk,
                                username: profile!.Username,
                              }))
                          : undefined
                      }
                      onTipClick={
                        selectedConversation.ChatType === ChatType.DM
                          ? () => {
                              const recipientPk =
                                selectedConversation.firstMessagePublicKey;
                              if (
                                recipientPk === appUser?.PublicKeyBase58Check
                              ) {
                                toast.info("You can't tip yourself");
                                return;
                              }
                              setTipTarget({
                                recipientPublicKey: recipientPk,
                                recipientUsername:
                                  activeChatUsersMap[recipientPk],
                              });
                            }
                          : undefined
                      }
                      onClick={async (
                        messageToSend: string,
                        extraData?: Record<string, string>,
                        options?: {
                          prepare?: () => Promise<Record<string, string>>;
                        }
                      ) => {
                        if (!selectedConversation) return;
                        // Merge reply data into extraData if replying
                        if (replyToMessage) {
                          extraData = {
                            ...extraData,
                            [MSG_REPLY_TO]: replyToMessage.timestamp,
                            [MSG_REPLY_PREVIEW]: replyToMessage.text.slice(
                              0,
                              200
                            ),
                            [MSG_REPLY_SENDER]: replyToMessage.sender,
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
                        const hasPrepare = !!options?.prepare;
                        const mockMessage = {
                          DecryptedMessage: messageToSend,
                          IsSender: true,
                          _status: (hasPrepare
                            ? "processing"
                            : "sending") as string,
                          _localId: localId,
                          SenderInfo: {
                            OwnerPublicKeyBase58Check:
                              appUser.PublicKeyBase58Check,
                            AccessGroupKeyName:
                              DEFAULT_KEY_MESSAGING_GROUP_NAME,
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
                        } as DecryptedMessageEntryResponse & {
                          _status: string;
                          _localId: string;
                        };

                        // Sending a message = implicit "caught up" — clear
                        // the unread divider so it doesn't persist above.
                        setOpenedLastReadNanos(null);

                        // Optimistic: insert immediately
                        const convKey = selectedConversationPublicKey;
                        setConversations((prev) => ({
                          ...prev,
                          [convKey]: {
                            ...prev[convKey],
                            messages: [mockMessage, ...prev[convKey].messages],
                          },
                        }));
                        setLockRefresh(true);

                        // If a prepare callback was provided (e.g. audio upload),
                        // run it now to get the final extraData before sending.
                        if (hasPrepare) {
                          try {
                            extraData = await options!.prepare!();
                            // Update the bubble with the real data
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.map((m: any) =>
                                  m._localId === localId
                                    ? {
                                        ...m,
                                        _status: "sending",
                                        MessageInfo: {
                                          ...m.MessageInfo,
                                          ExtraData: extraData,
                                        },
                                      }
                                    : m
                                ),
                              },
                            }));
                          } catch (e: any) {
                            // Remove the processing bubble on failure
                            setConversations((prev) => ({
                              ...prev,
                              [convKey]: {
                                ...prev[convKey],
                                messages: prev[convKey].messages.filter(
                                  (m: any) => m._localId !== localId
                                ),
                              },
                            }));
                            setLockRefresh(false);
                            toast.error(`Upload failed: ${e.message || e}`);
                            return;
                          }
                        }

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
                          removePendingMessage(
                            appUser.PublicKeyBase58Check,
                            localId
                          );
                          // Notify via WebSocket relay
                          notifyConversation(
                            convKey,
                            recipientPublicKey,
                            usernameByPublicKeyBase58Check[
                              appUser.PublicKeyBase58Check
                            ] || appUser.PublicKeyBase58Check
                          );
                          // Update status to "sent" (blockchain accepted)
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.map((m: any) =>
                                m._localId === localId
                                  ? { ...m, _status: "sent" }
                                  : m
                              ),
                            },
                          }));
                          // Start dedicated confirmation poller for this message.
                          // Checks the single conversation every 3s to confirm
                          // on-chain quickly instead of waiting for the general poll.
                          scheduleConfirmationCheck(
                            convKey,
                            localId,
                            selectedConversation.ChatType,
                            recipientPublicKey,
                            recipientAccessGroupKeyName
                          );
                        } catch (e: any) {
                          // Update status to "failed" — pending message stays in IndexedDB for retry
                          setConversations((prev) => ({
                            ...prev,
                            [convKey]: {
                              ...prev[convKey],
                              messages: prev[convKey].messages.map((m: any) =>
                                m._localId === localId
                                  ? { ...m, _status: "failed" }
                                  : m
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
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Block confirmation dialog */}
      {blockConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setBlockConfirm(null)}
          />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141c2b] border border-white/10 rounded-xl shadow-2xl p-6 w-[320px] max-w-[90vw]">
            <h3 className="text-white font-bold text-base mb-2">
              Block {blockConfirm.name}?
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              They won't be able to message you. You can unblock them later from
              the Requests tab.
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
                  handleBlockRequest(
                    blockConfirm.conversationKey,
                    blockConfirm.publicKey
                  );
                  setBlockConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-lg glass-btn-danger text-red-400 text-sm font-bold cursor-pointer transition-colors"
              >
                Block
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tip confirm dialog */}
      {tipTarget && appUser && (
        <Suspense fallback={null}>
          <LazyTipConfirmDialog
            appUser={appUser}
            recipientPublicKey={tipTarget.recipientPublicKey}
            recipientUsername={tipTarget.recipientUsername}
            tipReplyTo={tipTarget.tipReplyTo}
            initialAmountUsd={tipTarget.initialAmountUsd}
            onClose={() => {
              if (tipTarget?.tipReplyTo) {
                setPendingTipTimestamps((prev) => {
                  const next = new Set(prev);
                  next.delete(tipTarget.tipReplyTo!);
                  return next;
                });
              }
              setTipTarget(null);
            }}
            onTipSent={async (tipData) => {
              useStore.getState().addSessionTipUsd(tipData.amountUsd);
              try {
                const convKey = selectedConversationPublicKey;
                const conv = conversations[convKey];
                if (!conv) return;
                const recipientPublicKey =
                  conv.ChatType === ChatType.DM
                    ? conv.firstMessagePublicKey
                    : conv.messages[0].RecipientInfo.OwnerPublicKeyBase58Check;
                const recipientKeyName =
                  conv.ChatType === ChatType.DM
                    ? DEFAULT_KEY_MESSAGING_GROUP_NAME
                    : conv.messages[0].RecipientInfo.AccessGroupKeyName;

                const recipientName = tipData.recipientUsername
                  ? `@${tipData.recipientUsername}`
                  : tipData.recipientPublicKey.slice(0, 8);
                const hasCustomMessage = !!tipData.message?.trim();
                const fallback = tipData.message || `Tipped ${recipientName}`;

                await encryptAndSendNewMessage(
                  fallback,
                  appUser.PublicKeyBase58Check,
                  recipientPublicKey,
                  recipientKeyName,
                  DEFAULT_KEY_MESSAGING_GROUP_NAME,
                  buildExtraData({
                    type: "tip",
                    tipAmountNanos:
                      tipData.currency === "DESO"
                        ? tipData.amountNanos
                        : undefined,
                    tipAmountUsdcBaseUnits: tipData.amountUsdcBaseUnits,
                    tipCurrency: tipData.currency,
                    tipTxHash: tipData.txHash,
                    tipReplyTo: tipData.tipReplyTo,
                    tipRecipient: tipData.recipientPublicKey,
                    tipHasCustomMessage: hasCustomMessage,
                  })
                );
                // No push notification for tips
              } catch (e) {
                toast.error(
                  "Tip sent but message failed. The recipient received the funds."
                );
                console.error("Tip message error:", e);
              }
            }}
          />
        </Suspense>
      )}

      {/* In-app join group modal — triggered by clicking a join link in a chat */}
      <JoinGroupModalWrapper />

      {/* Confirmation modal — shown after redirect from /join/:code page */}
      <Suspense fallback={null}>
        <LazyJoinConfirmationModal />
      </Suspense>
    </div>
  );
};

/** Wrapper that subscribes to the pendingJoinCode store value */
function JoinGroupModalWrapper() {
  const code = useStore((s) => s.pendingJoinCode);
  if (!code) return null;
  return (
    <JoinGroupModal
      code={code}
      onClose={() => useStore.getState().setPendingJoinCode(null)}
    />
  );
}
