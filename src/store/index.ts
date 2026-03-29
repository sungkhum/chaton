import { create } from "zustand";
import {
  AccessGroupEntryResponse,
  User,
} from "deso-protocol";

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

  // Unread badges
  unreadByConversation: Map<string, number>;
  totalUnread: number;
  incrementUnread: (conversationKey: string) => void;
  clearUnread: (conversationKey: string) => void;
  resetUnread: () => void;

  // Chat Requests
  mutualFollows: Set<string>;
  approvedUsers: Set<string>;
  blockedUsers: Set<string>;
  initiatedChats: Set<string>;
  approvedAssociationIds: Map<string, string>;
  blockedAssociationIds: Map<string, string>;
  chatRequestsLoaded: boolean;

  setClassificationData: (
    mutualFollows: Set<string>,
    approved: Set<string>,
    blocked: Set<string>,
    approvedIds: Map<string, string>,
    blockedIds: Map<string, string>
  ) => void;
  addInitiatedChat: (publicKey: string) => void;
  approveUser: (publicKey: string) => void;
  blockUser: (publicKey: string) => void;
  rollbackApproval: (publicKey: string) => void;
  rollbackBlock: (publicKey: string) => void;
  resetChatRequestState: () => void;
}

const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, string>();

export const useStore = create<ChatOnState>((set) => ({
  // Auth
  appUser: null,
  isLoadingUser: true,
  allAccessGroups: [],

  setAppUser: (user) => set({ appUser: user }),

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
      const combined = state.allAccessGroups.concat(newAllAccessGroups);
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

  // Unread badges
  unreadByConversation: new Map(),
  totalUnread: 0,

  incrementUnread: (conversationKey) =>
    set((state) => {
      const next = new Map(state.unreadByConversation);
      next.set(conversationKey, (next.get(conversationKey) || 0) + 1);
      const total = Array.from(next.values()).reduce((a, b) => a + b, 0);
      if (navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
      return { unreadByConversation: next, totalUnread: total };
    }),

  clearUnread: (conversationKey) =>
    set((state) => {
      if (!state.unreadByConversation.has(conversationKey)) return state;
      const next = new Map(state.unreadByConversation);
      next.delete(conversationKey);
      const total = Array.from(next.values()).reduce((a, b) => a + b, 0);
      if (total === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
      else if (navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
      return { unreadByConversation: next, totalUnread: total };
    }),

  resetUnread: () => {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    set({ unreadByConversation: new Map(), totalUnread: 0 });
  },

  // Chat Requests
  mutualFollows: EMPTY_SET,
  approvedUsers: EMPTY_SET,
  blockedUsers: EMPTY_SET,
  initiatedChats: EMPTY_SET,
  approvedAssociationIds: EMPTY_MAP,
  blockedAssociationIds: EMPTY_MAP,
  chatRequestsLoaded: false,

  setClassificationData: (mutualFollows, approved, blocked, approvedIds, blockedIds) =>
    set({
      mutualFollows,
      approvedUsers: approved,
      blockedUsers: blocked,
      approvedAssociationIds: approvedIds,
      blockedAssociationIds: blockedIds,
      chatRequestsLoaded: true,
    }),

  addInitiatedChat: (publicKey) =>
    set((state) => ({
      initiatedChats: new Set([...state.initiatedChats, publicKey]),
    })),

  approveUser: (publicKey) =>
    set((state) => ({
      approvedUsers: new Set([...state.approvedUsers, publicKey]),
    })),

  blockUser: (publicKey) =>
    set((state) => ({
      blockedUsers: new Set([...state.blockedUsers, publicKey]),
    })),

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

  resetChatRequestState: () =>
    set({
      mutualFollows: EMPTY_SET,
      approvedUsers: EMPTY_SET,
      blockedUsers: EMPTY_SET,
      initiatedChats: EMPTY_SET,
      approvedAssociationIds: EMPTY_MAP,
      blockedAssociationIds: EMPTY_MAP,
      chatRequestsLoaded: false,
    }),
}));
