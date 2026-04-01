import { create } from "zustand";
import {
  AccessGroupEntryResponse,
  User,
} from "deso-protocol";
import {
  cacheClassificationData,
  cacheMutedConversations,
  cachePrivacyMode,
  cacheUserProfile,
  clearActiveServiceWorkerKeys,
} from "../services/cache.service";
import type { PrivacyMode } from "../utils/extra-data";

export type AppUser = User & {
  messagingPublicKeyBase58Check: string;
  accessGroupsOwned?: AccessGroupEntryResponse[];
};

export type MessageStatus = "sending" | "sent" | "confirmed" | "failed";

interface ChatOnState {
  // Auth
  appUser: AppUser | null;
  isLoadingUser: boolean;
  allAccessGroups: AccessGroupEntryResponse[];
  setAppUser: (user: AppUser | null) => void;
  setIsLoadingUser: (loading: boolean) => void;
  setAccessGroups: (groupsOwned: AccessGroupEntryResponse[]) => void;
  setAllAccessGroups: (newGroups: AccessGroupEntryResponse[]) => void;

  // UI
  lockRefresh: boolean;
  setLockRefresh: (lock: boolean) => void;
  pendingConversationKey: string | null;
  setPendingConversationKey: (key: string | null) => void;
  pendingJoinCode: string | null;
  setPendingJoinCode: (code: string | null) => void;

  // Unread badges
  unreadByConversation: Map<string, number>;
  totalUnread: number;
  incrementUnread: (conversationKey: string) => void;
  clearUnread: (conversationKey: string) => void;
  initializeUnread: (unreadMap: Map<string, number>) => void;
  resetUnread: () => void;

  // Muted conversations
  mutedConversations: Set<string>;
  toggleMute: (conversationKey: string) => void;
  setMutedConversations: (muted: Set<string>) => void;

  // Chat Requests
  mutualFollows: Set<string>;
  approvedUsers: Set<string>;
  blockedUsers: Set<string>;
  initiatedChats: Set<string>;
  approvedAssociationIds: Map<string, string>;
  blockedAssociationIds: Map<string, string>;
  chatRequestsLoaded: boolean;

  // Archived groups (left groups)
  archivedGroups: Set<string>;
  archivedGroupAssociationIds: Map<string, string>;

  // Archived DM chats
  archivedChats: Set<string>;
  archivedChatAssociationIds: Map<string, string>;

  // Dismissed requests
  dismissedUsers: Set<string>;
  dismissedAssociationIds: Map<string, string>;

  // Join request badges (for group owners in chat list)
  joinRequestCounts: Map<string, number>;
  setJoinRequestCounts: (counts: Map<string, number>) => void;
  decrementJoinRequestCount: (conversationKey: string, by?: number) => void;

  // Privacy mode — controls which ExtraData fields are encrypted
  privacyMode: PrivacyMode;
  privacyModeAssociationId: string | null;
  setPrivacyMode: (mode: PrivacyMode, associationId?: string | null) => void;

  setClassificationData: (
    mutualFollows: Set<string>,
    approved: Set<string>,
    blocked: Set<string>,
    approvedIds: Map<string, string>,
    blockedIds: Map<string, string>,
    archivedGroups: Set<string>,
    archivedGroupIds: Map<string, string>,
    archivedChats: Set<string>,
    archivedChatIds: Map<string, string>,
    dismissed: Set<string>,
    dismissedIds: Map<string, string>
  ) => void;
  addInitiatedChat: (publicKey: string) => void;
  approveUser: (publicKey: string) => void;
  blockUser: (publicKey: string) => void;
  rollbackApproval: (publicKey: string) => void;
  rollbackBlock: (publicKey: string) => void;
  archiveGroup: (conversationKey: string) => void;
  unarchiveGroup: (conversationKey: string) => void;
  rollbackArchive: (conversationKey: string) => void;
  rollbackUnarchive: (conversationKey: string, associationId: string) => void;
  mergeArchivedGroupIds: (ids: Map<string, string>) => void;
  archiveChat: (publicKey: string) => void;
  unarchiveChat: (publicKey: string) => void;
  rollbackArchiveChat: (publicKey: string) => void;
  rollbackUnarchiveChat: (publicKey: string, associationId: string) => void;
  mergeArchivedChatIds: (ids: Map<string, string>) => void;
  dismissUser: (publicKey: string) => void;
  undismissUser: (publicKey: string) => void;
  rollbackDismiss: (publicKey: string) => void;
  rollbackUndismiss: (publicKey: string, associationId: string) => void;
  mergeDismissedIds: (ids: Map<string, string>) => void;
  unblockUser: (publicKey: string) => void;
  rollbackUnblock: (publicKey: string, associationId: string) => void;
  resetChatRequestState: () => void;
}

const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, string>();

/** Build a ClassificationData snapshot from current state, with optional overrides. */
function classificationSnapshot(
  state: ChatOnState,
  overrides: Partial<{
    mutualFollows: Set<string>;
    approvedUsers: Set<string>;
    blockedUsers: Set<string>;
    approvedAssociationIds: Map<string, string>;
    blockedAssociationIds: Map<string, string>;
    archivedGroups: Set<string>;
    archivedGroupAssociationIds: Map<string, string>;
    archivedChats: Set<string>;
    archivedChatAssociationIds: Map<string, string>;
    dismissedUsers: Set<string>;
    dismissedAssociationIds: Map<string, string>;
  }> = {}
) {
  return {
    mutualFollows: overrides.mutualFollows ?? state.mutualFollows,
    approvedUsers: overrides.approvedUsers ?? state.approvedUsers,
    blockedUsers: overrides.blockedUsers ?? state.blockedUsers,
    approvedAssociationIds: overrides.approvedAssociationIds ?? state.approvedAssociationIds,
    blockedAssociationIds: overrides.blockedAssociationIds ?? state.blockedAssociationIds,
    archivedGroups: overrides.archivedGroups ?? state.archivedGroups,
    archivedGroupAssociationIds: overrides.archivedGroupAssociationIds ?? state.archivedGroupAssociationIds,
    archivedChats: overrides.archivedChats ?? state.archivedChats,
    archivedChatAssociationIds: overrides.archivedChatAssociationIds ?? state.archivedChatAssociationIds,
    dismissedUsers: overrides.dismissedUsers ?? state.dismissedUsers,
    dismissedAssociationIds: overrides.dismissedAssociationIds ?? state.dismissedAssociationIds,
  };
}

export const useStore = create<ChatOnState>((set) => ({
  // Auth
  appUser: null,
  isLoadingUser: true,
  allAccessGroups: [],

  setAppUser: (user) =>
    set((state) => {
      if (user) {
        cacheUserProfile(
          user.PublicKeyBase58Check,
          user,
          state.allAccessGroups
        );
      }
      return { appUser: user };
    }),

  setIsLoadingUser: (loading) => set({ isLoadingUser: loading }),

  setAccessGroups: (accessGroupsOwned) =>
    set((state) => {
      if (!state.appUser) {
        throw new Error("cannot set access groups without a logged in user!");
      }
      return { appUser: { ...state.appUser, accessGroupsOwned } };
    }),

  setAllAccessGroups: (newAllAccessGroups) =>
    set((state) => {
      // New groups come first so fresh blockchain data (with ExtraData)
      // wins over stale cached entries during deduplication.
      const combined = newAllAccessGroups.concat(state.allAccessGroups);
      const seen = new Set<string>();
      const allAccessGroups = combined.filter((group) => {
        const key =
          group.AccessGroupOwnerPublicKeyBase58Check + group.AccessGroupKeyName;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { allAccessGroups };
    }),

  // UI
  lockRefresh: false,
  setLockRefresh: (lockRefresh) => set({ lockRefresh }),
  pendingConversationKey: null,
  setPendingConversationKey: (pendingConversationKey) => set({ pendingConversationKey }),
  pendingJoinCode: null,
  setPendingJoinCode: (pendingJoinCode) => set({ pendingJoinCode }),

  // Unread badges
  unreadByConversation: new Map(),
  totalUnread: 0,

  incrementUnread: (conversationKey) =>
    set((state) => {
      const next = new Map(state.unreadByConversation);
      next.set(conversationKey, (next.get(conversationKey) || 0) + 1);
      // js-combine-iterations: simple loop avoids intermediate array allocation
      let total = 0;
      for (const v of next.values()) total += v;
      if (navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
      return { unreadByConversation: next, totalUnread: total };
    }),

  clearUnread: (conversationKey) =>
    set((state) => {
      if (!state.unreadByConversation.has(conversationKey)) return state;
      const next = new Map(state.unreadByConversation);
      next.delete(conversationKey);
      let total = 0;
      for (const v of next.values()) total += v;
      if (total === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
      else if (navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
      return { unreadByConversation: next, totalUnread: total };
    }),

  initializeUnread: (unreadMap) =>
    set((state) => {
      // Merge with any existing unread counts (from WebSocket during load)
      const next = new Map(state.unreadByConversation);
      for (const [key, count] of unreadMap) {
        if (!next.has(key)) next.set(key, count);
      }
      let total = 0;
      for (const v of next.values()) total += v;
      if (total > 0 && navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
      return { unreadByConversation: next, totalUnread: total };
    }),

  resetUnread: () => {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    set({ unreadByConversation: new Map(), totalUnread: 0 });
  },

  // Muted conversations
  mutedConversations: EMPTY_SET,

  toggleMute: (conversationKey) =>
    set((state) => {
      const next = new Set(state.mutedConversations);
      if (next.has(conversationKey)) {
        next.delete(conversationKey);
      } else {
        next.add(conversationKey);
      }
      const publicKey = state.appUser?.PublicKeyBase58Check;
      if (publicKey) cacheMutedConversations(publicKey, next);
      return { mutedConversations: next };
    }),

  setMutedConversations: (muted) =>
    set((state) => {
      const publicKey = state.appUser?.PublicKeyBase58Check;
      if (publicKey) cacheMutedConversations(publicKey, muted);
      return { mutedConversations: muted };
    }),

  // Chat Requests
  mutualFollows: EMPTY_SET,
  approvedUsers: EMPTY_SET,
  blockedUsers: EMPTY_SET,
  initiatedChats: EMPTY_SET,
  approvedAssociationIds: EMPTY_MAP,
  blockedAssociationIds: EMPTY_MAP,
  chatRequestsLoaded: false,

  // Archived groups
  archivedGroups: EMPTY_SET,
  archivedGroupAssociationIds: EMPTY_MAP,

  // Archived DM chats
  archivedChats: EMPTY_SET,
  archivedChatAssociationIds: EMPTY_MAP,

  // Dismissed requests
  dismissedUsers: EMPTY_SET,
  dismissedAssociationIds: EMPTY_MAP,

  // Join request badges
  joinRequestCounts: new Map(),

  setJoinRequestCounts: (counts) => set({ joinRequestCounts: counts }),

  decrementJoinRequestCount: (conversationKey, by = 1) =>
    set((state) => {
      const next = new Map(state.joinRequestCounts);
      const current = next.get(conversationKey) || 0;
      const updated = Math.max(0, current - by);
      if (updated === 0) next.delete(conversationKey);
      else next.set(conversationKey, updated);
      return { joinRequestCounts: next };
    }),

  // Privacy mode
  privacyMode: "full" as PrivacyMode,
  privacyModeAssociationId: null,
  setPrivacyMode: (mode, associationId) =>
    set((state) => {
      const publicKey = state.appUser?.PublicKeyBase58Check;
      if (publicKey) cachePrivacyMode(publicKey, mode);
      return {
        privacyMode: mode,
        ...(associationId !== undefined ? { privacyModeAssociationId: associationId } : {}),
      };
    }),

  setClassificationData: (mutualFollows, approved, blocked, approvedIds, blockedIds, archived, archivedIds, archivedChatsSet, archivedChatIds, dismissed, dismissedIds) =>
    set((state) => {
      const publicKey = state.appUser?.PublicKeyBase58Check;
      if (publicKey) {
        cacheClassificationData(publicKey, {
          mutualFollows,
          approvedUsers: approved,
          blockedUsers: blocked,
          approvedAssociationIds: approvedIds,
          blockedAssociationIds: blockedIds,
          archivedGroups: archived,
          archivedGroupAssociationIds: archivedIds,
          archivedChats: archivedChatsSet,
          archivedChatAssociationIds: archivedChatIds,
          dismissedUsers: dismissed,
          dismissedAssociationIds: dismissedIds,
        });
      }
      return {
        mutualFollows,
        approvedUsers: approved,
        blockedUsers: blocked,
        approvedAssociationIds: approvedIds,
        blockedAssociationIds: blockedIds,
        archivedGroups: archived,
        archivedGroupAssociationIds: archivedIds,
        archivedChats: archivedChatsSet,
        archivedChatAssociationIds: archivedChatIds,
        dismissedUsers: dismissed,
        dismissedAssociationIds: dismissedIds,
        chatRequestsLoaded: true,
      };
    }),

  addInitiatedChat: (publicKey) =>
    set((state) => ({
      initiatedChats: new Set([...state.initiatedChats, publicKey]),
    })),

  approveUser: (publicKey) =>
    set((state) => {
      const next = new Set([...state.approvedUsers, publicKey]);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { approvedUsers: next }));
      return { approvedUsers: next };
    }),

  blockUser: (publicKey) =>
    set((state) => {
      const next = new Set([...state.blockedUsers, publicKey]);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { blockedUsers: next }));
      return { blockedUsers: next };
    }),

  rollbackApproval: (publicKey) =>
    set((state) => {
      const next = new Set(state.approvedUsers);
      next.delete(publicKey);
      return { approvedUsers: next };
    }),

  rollbackBlock: (publicKey) =>
    set((state) => {
      const next = new Set(state.blockedUsers);
      next.delete(publicKey);
      return { blockedUsers: next };
    }),

  archiveGroup: (conversationKey) =>
    set((state) => {
      const next = new Set([...state.archivedGroups, conversationKey]);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { archivedGroups: next }));
      return { archivedGroups: next };
    }),

  unarchiveGroup: (conversationKey) =>
    set((state) => {
      const next = new Set(state.archivedGroups);
      next.delete(conversationKey);
      const nextIds = new Map(state.archivedGroupAssociationIds);
      nextIds.delete(conversationKey);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { archivedGroups: next, archivedGroupAssociationIds: nextIds }));
      return { archivedGroups: next, archivedGroupAssociationIds: nextIds };
    }),

  rollbackArchive: (conversationKey) =>
    set((state) => {
      const next = new Set(state.archivedGroups);
      next.delete(conversationKey);
      return { archivedGroups: next };
    }),

  rollbackUnarchive: (conversationKey, associationId) =>
    set((state) => {
      const next = new Set([...state.archivedGroups, conversationKey]);
      const nextIds = new Map(state.archivedGroupAssociationIds);
      nextIds.set(conversationKey, associationId);
      return { archivedGroups: next, archivedGroupAssociationIds: nextIds };
    }),

  mergeArchivedGroupIds: (ids) =>
    set((state) => {
      const nextIds = new Map(state.archivedGroupAssociationIds);
      for (const [k, v] of ids) nextIds.set(k, v);
      return { archivedGroupAssociationIds: nextIds };
    }),

  // ── Archived DM chats ──

  archiveChat: (publicKey) =>
    set((state) => {
      const next = new Set([...state.archivedChats, publicKey]);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { archivedChats: next }));
      return { archivedChats: next };
    }),

  unarchiveChat: (publicKey) =>
    set((state) => {
      const next = new Set(state.archivedChats);
      next.delete(publicKey);
      const nextIds = new Map(state.archivedChatAssociationIds);
      nextIds.delete(publicKey);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { archivedChats: next, archivedChatAssociationIds: nextIds }));
      return { archivedChats: next, archivedChatAssociationIds: nextIds };
    }),

  rollbackArchiveChat: (publicKey) =>
    set((state) => {
      const next = new Set(state.archivedChats);
      next.delete(publicKey);
      return { archivedChats: next };
    }),

  rollbackUnarchiveChat: (publicKey, associationId) =>
    set((state) => {
      const next = new Set([...state.archivedChats, publicKey]);
      const nextIds = new Map(state.archivedChatAssociationIds);
      nextIds.set(publicKey, associationId);
      return { archivedChats: next, archivedChatAssociationIds: nextIds };
    }),

  mergeArchivedChatIds: (ids) =>
    set((state) => {
      const nextIds = new Map(state.archivedChatAssociationIds);
      for (const [k, v] of ids) nextIds.set(k, v);
      return { archivedChatAssociationIds: nextIds };
    }),

  // ── Dismissed requests ──

  dismissUser: (publicKey) =>
    set((state) => {
      const next = new Set([...state.dismissedUsers, publicKey]);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { dismissedUsers: next }));
      return { dismissedUsers: next };
    }),

  undismissUser: (publicKey) =>
    set((state) => {
      const next = new Set(state.dismissedUsers);
      next.delete(publicKey);
      const nextIds = new Map(state.dismissedAssociationIds);
      nextIds.delete(publicKey);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { dismissedUsers: next, dismissedAssociationIds: nextIds }));
      return { dismissedUsers: next, dismissedAssociationIds: nextIds };
    }),

  rollbackDismiss: (publicKey) =>
    set((state) => {
      const next = new Set(state.dismissedUsers);
      next.delete(publicKey);
      return { dismissedUsers: next };
    }),

  rollbackUndismiss: (publicKey, associationId) =>
    set((state) => {
      const next = new Set([...state.dismissedUsers, publicKey]);
      const nextIds = new Map(state.dismissedAssociationIds);
      nextIds.set(publicKey, associationId);
      return { dismissedUsers: next, dismissedAssociationIds: nextIds };
    }),

  mergeDismissedIds: (ids) =>
    set((state) => {
      const nextIds = new Map(state.dismissedAssociationIds);
      for (const [k, v] of ids) nextIds.set(k, v);
      return { dismissedAssociationIds: nextIds };
    }),

  // ── Unblock ──

  unblockUser: (publicKey) =>
    set((state) => {
      const next = new Set(state.blockedUsers);
      next.delete(publicKey);
      const nextIds = new Map(state.blockedAssociationIds);
      nextIds.delete(publicKey);
      const myKey = state.appUser?.PublicKeyBase58Check;
      if (myKey) cacheClassificationData(myKey, classificationSnapshot(state, { blockedUsers: next, blockedAssociationIds: nextIds }));
      return { blockedUsers: next, blockedAssociationIds: nextIds };
    }),

  rollbackUnblock: (publicKey, associationId) =>
    set((state) => {
      const next = new Set([...state.blockedUsers, publicKey]);
      const nextIds = new Map(state.blockedAssociationIds);
      nextIds.set(publicKey, associationId);
      return { blockedUsers: next, blockedAssociationIds: nextIds };
    }),

  resetChatRequestState: () => {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    clearActiveServiceWorkerKeys();
    set({
      mutualFollows: EMPTY_SET,
      approvedUsers: EMPTY_SET,
      blockedUsers: EMPTY_SET,
      initiatedChats: EMPTY_SET,
      approvedAssociationIds: EMPTY_MAP,
      blockedAssociationIds: EMPTY_MAP,
      archivedGroups: EMPTY_SET,
      archivedGroupAssociationIds: EMPTY_MAP,
      archivedChats: EMPTY_SET,
      archivedChatAssociationIds: EMPTY_MAP,
      dismissedUsers: EMPTY_SET,
      dismissedAssociationIds: EMPTY_MAP,
      chatRequestsLoaded: false,
      mutedConversations: EMPTY_SET,
      joinRequestCounts: new Map(),
      privacyMode: "full" as PrivacyMode,
      privacyModeAssociationId: null,
      unreadByConversation: new Map(),
      totalUnread: 0,
    });
  },
}));
