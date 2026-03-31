import { ChatType, identity, ProfileEntryResponse } from "deso-protocol";
import { Archive, ArrowLeft, BellOff, Check, ChevronDown, ChevronRight, MessageSquarePlus, Pencil, RotateCcw, Search, Share2, ShieldOff, Users, X } from "lucide-react";
import { FC, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import { MessageSearchResult, SearchProgress } from "../services/message-search.service";
import { getGroupImageUrl } from "../utils/extra-data";
import { formatRelativeTimestamp, getChatNameFromConversation } from "../utils/helpers";
import { Conversation, ConversationMap } from "../utils/types";
import { ComposePanel } from "./compose-panel";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SearchMessageResults } from "./search-message-results";
import { shortenLongWord } from "./search-users";
import { StartGroupChat } from "./start-group-chat";

const sortConversations = (
  entries: [string, Conversation][],
  selectedKey: string
) =>
  entries.sort(([aPub, convoA], [bPub, convoB]) => {
    if (convoA.messages.length === 0) {
      return aPub === selectedKey ? -1 : 1;
    }
    if (convoB.messages.length === 0) {
      return bPub === selectedKey ? 1 : -1;
    }
    return (
      convoB.messages[0].MessageInfo.TimestampNanos -
      convoA.messages[0].MessageInfo.TimestampNanos
    );
  });

export const MessagingConversationAccount: FC<{
  conversations: ConversationMap;
  requestConversations: ConversationMap;
  archivedConversations: ConversationMap;
  getUsernameByPublicKeyBase58Check: { [key: string]: string };
  selectedConversationPublicKey: string;
  onClick: (publicKey: string) => void;
  rehydrateConversation: (publicKey?: string, autoScroll?: boolean) => void;
  onAccept: (conversationKey: string, publicKey: string) => void;
  onBlock: (conversationKey: string, publicKey: string) => void;
  onDismiss: (conversationKey: string, publicKey: string) => void;
  onUnarchive: (conversationKey: string) => void;
  onUnarchiveChat: (publicKey: string) => void;
  onArchiveChat: (conversationKey: string, publicKey: string) => void;
  onUnblock: (publicKey: string) => void;
  onUndismiss: (publicKey: string) => void;
  blockedUsers: Set<string>;
  dismissedUsers: Set<string>;
  blockedAssociationIds: Map<string, string>;
  dismissedAssociationIds: Map<string, string>;
  unreadByConversation: Map<string, number>;
  mutedConversations: Set<string>;
  membersByGroupKey: {
    [groupKey: string]: { [publicKey: string]: ProfileEntryResponse | null };
  };
  searchQuery?: string;
  searchResults?: MessageSearchResult[];
  isSearching?: boolean;
  isDeepSearching?: boolean;
  searchProgress?: SearchProgress | null;
  onSearchQueryChange?: (query: string) => void;
  onSearchResultClick?: (conversationKey: string) => void;
  searchClearTrigger?: number;
}> = ({
  conversations,
  requestConversations,
  archivedConversations,
  getUsernameByPublicKeyBase58Check,
  selectedConversationPublicKey,
  onClick,
  rehydrateConversation,
  onAccept,
  onBlock,
  onDismiss,
  onUnarchive,
  onUnarchiveChat,
  onArchiveChat,
  onUnblock,
  onUndismiss,
  blockedUsers,
  dismissedUsers,
  blockedAssociationIds,
  dismissedAssociationIds,
  unreadByConversation,
  mutedConversations,
  membersByGroupKey,
  searchQuery = "",
  searchResults = [],
  isSearching = false,
  isDeepSearching = false,
  searchProgress = null,
  onSearchQueryChange,
  onSearchResultClick,
  searchClearTrigger,
}) => {
  const { allAccessGroups } = useStore();
  const [activeTab, setActiveTab] = useState<"chats" | "requests">("chats");
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [requestSubView, setRequestSubView] = useState<"list" | "blocked" | "dismissed">("list");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const requestCount = Object.keys(requestConversations).length;
  const archivedCount = Object.keys(archivedConversations).length;
  const chatCount = Object.keys(conversations).length;
  const blockedCount = blockedUsers.size;
  const dismissedCount = dismissedUsers.size;

  const handleComposeSelectUser = (publicKeyWithGroup: string) => {
    rehydrateConversation(publicKeyWithGroup, true);
  };

  // Reset sub-view when switching tabs
  useEffect(() => {
    if (activeTab !== "requests") setRequestSubView("list");
  }, [activeTab]);

  return (
    <div className="h-full rounded-md rounded-r-none relative overflow-hidden">
      <StartGroupChat
        onSuccess={rehydrateConversation}
        open={groupChatOpen}
        onOpenChange={setGroupChatOpen}
      />

      <ComposePanel
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSelectUser={handleComposeSelectUser}
        onNewGroup={() => setGroupChatOpen(true)}
      />

      {/* Search bar for filtering existing conversations */}
      <div className="m-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search conversations..."
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            className="w-full rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 bg-white/5 border border-white/8 hover:border-[#34F080]/30 focus:border-[#34F080]/50 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange?.("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="h-full max-h-[calc(100%-68px)]">
        {/* Message search results — replaces tabs when searching */}
        {searchQuery.trim().length >= 2 ? (
          <SearchMessageResults
            results={searchResults}
            query={searchQuery}
            isSearching={isSearching}
            isDeepSearching={isDeepSearching}
            progress={searchProgress}
            onSelectResult={(key) => onSearchResultClick?.(key)}
          />
        ) : (
        <>
        {/* Tab Header — Two tabs only: Chats and Requests */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-3 text-sm font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === "chats"
                ? "border-[#34F080] text-[#34F080]"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 py-3 text-sm font-bold transition-colors cursor-pointer border-b-2 relative ${
              activeTab === "requests"
                ? "border-[#34F080] text-[#34F080]"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Requests
            {requestCount > 0 && (
              <span className="ml-1.5 bg-[#34F080] text-black text-[10px] font-bold rounded-full w-5 h-5 inline-flex items-center justify-center">
                {requestCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-[calc(100%-46px)] relative">
          {activeTab === "chats" && (
            <div className="conversations-list overflow-y-auto max-h-full custom-scrollbar pb-24">
              {/* Telegram-style collapsible archived section */}
              {archivedCount > 0 && (
                <div>
                  <button
                    onClick={() => setArchiveExpanded(!archiveExpanded)}
                    className="w-full px-4 py-3 flex items-center gap-2.5 text-gray-400 hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-white/5"
                  >
                    <Archive className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium flex-1 text-left">
                      Archived Chats
                    </span>
                    <span className="text-xs text-gray-500 mr-1">{archivedCount}</span>
                    {archiveExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {archiveExpanded && (
                    <div className="bg-white/[0.01] border-b border-white/5 max-h-[280px] overflow-y-auto custom-scrollbar">
                      {sortConversations(
                        Object.entries(archivedConversations),
                        selectedConversationPublicKey
                      ).map(([key, value]) => {
                        const isDM = value.ChatType === ChatType.DM;
                        const isGroupChat = value.ChatType === ChatType.GROUPCHAT;
                        const chatName = getChatNameFromConversation(
                          value,
                          getUsernameByPublicKeyBase58Check
                        );
                        const timestamp = value.messages[0]
                          ? formatRelativeTimestamp(value.messages[0].MessageInfo.TimestampNanos)
                          : "";
                        const displayName =
                          shortenLongWord(chatName, 7, 7) || shortenLongWord(key);
                        const archivedGroupImgUrl = isGroupChat
                          ? getGroupImageUrl(
                              allAccessGroups,
                              value.messages[0].RecipientInfo.OwnerPublicKeyBase58Check,
                              value.messages[0].RecipientInfo.AccessGroupKeyName
                            )
                          : undefined;

                        return (
                          <div key={`archived-thread-${key}`}>
                            <div className="px-4 py-3 hover:bg-white/5 transition-colors">
                              <div
                                onClick={() => onClick(key)}
                                className="flex items-center gap-3 cursor-pointer"
                              >
                                <MessagingDisplayAvatar
                                  username={isDM ? chatName : undefined}
                                  publicKey={isDM ? value.firstMessagePublicKey : chatName || ""}
                                  groupChat={isGroupChat}
                                  groupImageUrl={archivedGroupImgUrl}
                                  diameter={44}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {isGroupChat && (
                                        <Users className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                                      )}
                                      <span className="truncate text-sm text-gray-400 font-medium">
                                        {displayName}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                                      {timestamp}
                                    </span>
                                  </div>
                                  {value.messages[0] && (
                                    <p className="truncate text-sm text-gray-500">
                                      {value.messages[0].DecryptedMessage.slice(0, 60)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 ml-[56px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isGroupChat) {
                                      onUnarchive(key);
                                    } else {
                                      onUnarchiveChat(value.firstMessagePublicKey);
                                    }
                                  }}
                                  className="flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#34F080]/15 text-[#34F080] text-xs font-bold hover:bg-[#34F080]/25 cursor-pointer transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  {isGroupChat ? "Rejoin" : "Unarchive"}
                                </button>
                              </div>
                            </div>
                            <div className="ml-[72px] border-b border-white/5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Regular chat list */}
              {chatCount === 0 && archivedCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#34F080]/10 flex items-center justify-center mb-4">
                    <MessageSquarePlus className="w-8 h-8 text-[#34F080]" />
                  </div>
                  <h3 className="text-white font-semibold text-base mb-1.5">No conversations yet</h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-[220px]">
                    Start chatting with someone on DeSo or Ethereum
                  </p>
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black font-bold rounded-full py-2.5 px-6 text-sm hover:brightness-110 cursor-pointer transition-all"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : sortConversations(
                Object.entries(conversations),
                selectedConversationPublicKey
              ).map(([key, value]) => {
                const isDM = value.ChatType === ChatType.DM;
                const isGroupChat = value.ChatType === ChatType.GROUPCHAT;
                const publicKey = isDM
                  ? value.firstMessagePublicKey
                  : value.messages[0].RecipientInfo.OwnerPublicKeyBase58Check;
                const chatName = getChatNameFromConversation(
                  value,
                  getUsernameByPublicKeyBase58Check
                );
                const isSelected = key === selectedConversationPublicKey;
                const selectedConversationStyle = isSelected
                  ? "selected-conversation bg-white/5"
                  : "";
                const unreadCount = unreadByConversation.get(key) || 0;
                const hasUnread = unreadCount > 0;
                const isMuted = mutedConversations.has(key);
                const timestamp = value.messages[0]
                  ? formatRelativeTimestamp(value.messages[0].MessageInfo.TimestampNanos)
                  : "";
                const displayName =
                  shortenLongWord(chatName, 7, 7) || shortenLongWord(publicKey);
                const groupImgUrl = isGroupChat
                  ? getGroupImageUrl(
                      allAccessGroups,
                      value.messages[0].RecipientInfo.OwnerPublicKeyBase58Check,
                      value.messages[0].RecipientInfo.AccessGroupKeyName
                    )
                  : undefined;

                return (
                  <div key={`message-thread-${key}`}>
                    <div
                      onClick={() => onClick(key)}
                      className={`px-4 py-3 ${selectedConversationStyle} hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors ${
                        hasUnread && !isSelected
                          ? "bg-white/[0.03]"
                          : ""
                      }`}
                    >
                      <MessagingDisplayAvatar
                        username={isDM ? chatName : undefined}
                        publicKey={isDM ? value.firstMessagePublicKey : chatName || ""}
                        groupChat={isGroupChat}
                        groupImageUrl={groupImgUrl}
                        diameter={48}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Line 1: Name + Timestamp */}
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            {isGroupChat && (
                              <Users className={`w-3.5 h-3.5 shrink-0 ${hasUnread ? "text-gray-300" : "text-gray-400"}`} />
                            )}
                            <span
                              className={`truncate text-sm ${
                                hasUnread
                                  ? "text-white font-bold"
                                  : "text-gray-400 font-medium"
                              }`}
                            >
                              {displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {isMuted && (
                              <BellOff className="w-3.5 h-3.5 text-gray-500" />
                            )}
                            <span
                              className={`text-xs ${
                                hasUnread ? "text-[#34F080] font-bold" : "text-gray-500"
                              }`}
                            >
                              {timestamp}
                            </span>
                          </div>
                        </div>

                        {/* Line 2: Preview + Unread badge */}
                        <div className="flex items-center justify-between">
                          <p
                            className={`truncate text-sm ${
                              hasUnread
                                ? "text-white/80 font-medium"
                                : "text-gray-500"
                            }`}
                          >
                            {value.messages[0]
                              ? value.messages[0].DecryptedMessage.slice(0, 60)
                              : ""}
                          </p>
                          {hasUnread && (
                            <span className="bg-[#34F080] text-black text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shrink-0 ml-2">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-[76px] border-b border-white/5" />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "requests" && (
            <div className="conversations-list overflow-y-auto max-h-full custom-scrollbar pb-24">
              {/* Sub-navigation for blocked/dismissed lists */}
              {requestSubView === "blocked" && (
                <div>
                  <button
                    onClick={() => setRequestSubView("list")}
                    className="w-full px-4 py-3 flex items-center gap-2 text-gray-300 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/10"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-bold">Blocked Users</span>
                  </button>
                  {blockedCount === 0 ? (
                    <div className="text-gray-500 text-sm text-center mt-8 px-6">
                      No blocked users
                    </div>
                  ) : (
                    <>
                      {Array.from(blockedUsers).map((pubKey) => {
                        const username = getUsernameByPublicKeyBase58Check[pubKey];
                        const displayName = username
                          ? shortenLongWord(username, 7, 7)
                          : shortenLongWord(pubKey);
                        return (
                          <div key={`blocked-${pubKey}`}>
                            <div className="px-4 py-3 flex items-center gap-3">
                              <MessagingDisplayAvatar
                                username={username}
                                publicKey={pubKey}
                                diameter={44}
                              />
                              <span className="flex-1 truncate text-sm text-gray-300 font-medium">
                                {displayName}
                              </span>
                              <button
                                onClick={() => onUnblock(pubKey)}
                                className="flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white cursor-pointer transition-colors shrink-0"
                              >
                                <ShieldOff className="w-3.5 h-3.5" />
                                Unblock
                              </button>
                            </div>
                            <div className="ml-[68px] border-b border-white/5" />
                          </div>
                        );
                      })}
                      <p className="text-gray-600 text-xs text-center mt-4 px-6">
                        Unblocking lets them message you again.
                      </p>
                    </>
                  )}
                </div>
              )}

              {requestSubView === "dismissed" && (
                <div>
                  <button
                    onClick={() => setRequestSubView("list")}
                    className="w-full px-4 py-3 flex items-center gap-2 text-gray-300 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/10"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-bold">Dismissed Requests</span>
                  </button>
                  {dismissedCount === 0 ? (
                    <div className="text-gray-500 text-sm text-center mt-8 px-6">
                      No dismissed requests
                    </div>
                  ) : (
                    <>
                      {Array.from(dismissedUsers).map((pubKey) => {
                        const username = getUsernameByPublicKeyBase58Check[pubKey];
                        const displayName = username
                          ? shortenLongWord(username, 7, 7)
                          : shortenLongWord(pubKey);
                        return (
                          <div key={`dismissed-${pubKey}`}>
                            <div className="px-4 py-3 flex items-center gap-3">
                              <MessagingDisplayAvatar
                                username={username}
                                publicKey={pubKey}
                                diameter={44}
                              />
                              <span className="flex-1 truncate text-sm text-gray-300 font-medium">
                                {displayName}
                              </span>
                              <button
                                onClick={() => onUndismiss(pubKey)}
                                className="flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#34F080]/15 text-[#34F080] text-xs font-bold hover:bg-[#34F080]/25 cursor-pointer transition-colors shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Undo
                              </button>
                            </div>
                            <div className="ml-[68px] border-b border-white/5" />
                          </div>
                        );
                      })}
                      <p className="text-gray-600 text-xs text-center mt-4 px-6">
                        Undoing moves the request back to your Requests list.
                      </p>
                    </>
                  )}
                </div>
              )}

              {requestSubView === "list" && (
                <>
                  {requestCount === 0 ? (
                    <div className="text-gray-500 text-sm text-center mt-8 px-6">
                      No message requests
                    </div>
                  ) : (
                    sortConversations(
                      Object.entries(requestConversations),
                      selectedConversationPublicKey
                    ).map(([key, value]) => {
                      const publicKey = value.firstMessagePublicKey;
                      const chatName = getChatNameFromConversation(
                        value,
                        getUsernameByPublicKeyBase58Check
                      );
                      const selectedConversationStyle =
                        key === selectedConversationPublicKey
                          ? "selected-conversation bg-white/5"
                          : "";
                      const timestamp = value.messages[0]
                        ? formatRelativeTimestamp(value.messages[0].MessageInfo.TimestampNanos)
                        : "";
                      const displayName =
                        shortenLongWord(chatName, 7, 7) || shortenLongWord(publicKey);

                      return (
                        <div key={`request-thread-${key}`}>
                          <div
                            className={`px-4 py-3 ${selectedConversationStyle} hover:bg-white/5 transition-colors`}
                          >
                            <div
                              onClick={() => onClick(key)}
                              className="flex items-center gap-3 cursor-pointer"
                            >
                              <MessagingDisplayAvatar
                                username={chatName}
                                publicKey={publicKey}
                                diameter={48}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="truncate text-sm text-white font-semibold">
                                    {displayName}
                                  </span>
                                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                                    {timestamp}
                                  </span>
                                </div>
                                {value.messages[0] && (
                                  <p className="truncate text-sm text-gray-500">
                                    {value.messages[0].DecryptedMessage.slice(0, 60)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2 ml-[60px] flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAccept(key, publicKey);
                                }}
                                className="flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#34F080]/15 text-[#34F080] text-xs font-bold hover:bg-[#34F080]/25 cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBlock(key, publicKey);
                                }}
                                className="flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-bold hover:bg-red-500/15 hover:text-red-400 cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                Block
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDismiss(key, publicKey);
                                }}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/[0.03] text-gray-500 text-xs font-medium hover:bg-white/5 hover:text-gray-300 cursor-pointer transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                          <div className="ml-[76px] border-b border-white/5" />
                        </div>
                      );
                    })
                  )}

                  {/* Footer links for blocked/dismissed */}
                  {(blockedCount > 0 || dismissedCount > 0) && (
                    <div className="mt-4 mx-4 pt-4 border-t border-white/5 space-y-1 mb-4">
                      {blockedCount > 0 && (
                        <button
                          onClick={() => setRequestSubView("blocked")}
                          className="w-full flex items-center justify-between px-3 min-h-[44px] py-2.5 rounded-lg text-gray-500 text-sm hover:bg-white/5 hover:text-gray-300 cursor-pointer transition-colors"
                        >
                          <span>Blocked users ({blockedCount})</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                      {dismissedCount > 0 && (
                        <button
                          onClick={() => setRequestSubView("dismissed")}
                          className="w-full flex items-center justify-between px-3 min-h-[44px] py-2.5 rounded-lg text-gray-500 text-sm hover:bg-white/5 hover:text-gray-300 cursor-pointer transition-colors"
                        >
                          <span>Dismissed requests ({dismissedCount})</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Bottom actions — Invite + Compose */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-end justify-between p-4 md:p-3">
          {/* Invite Friends pill */}
          <button
            onClick={async () => {
              const shareData = {
                title: "ChatOn",
                text: "Chat with me on ChatOn — decentralized, end-to-end encrypted messaging on the blockchain. No censorship, no middlemen.",
                url: "https://getchaton.com",
              };
              if (navigator.share) {
                try { await navigator.share(shareData); } catch { /* cancelled */ }
              } else {
                navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                toast.success("Invite link copied!");
              }
            }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 hover:border-[#34F080]/40 hover:bg-[#34F080]/10 text-gray-400 hover:text-[#34F080] text-sm font-medium cursor-pointer transition-all active:scale-95 backdrop-blur-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Friends</span>
          </button>

          {/* Compose FAB */}
          <button
            onClick={() => setComposeOpen(true)}
            className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-r from-[#34F080] to-[#20E0AA] flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-95 hover:brightness-110 md:w-12 md:h-12"
          >
            <Pencil className="w-6 h-6 text-black md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Kept for potential future use but no longer rendered in conversation rows
export const MessagingGroupMembers: FC<{
  membersMap: { [publicKey: string]: ProfileEntryResponse | null };
  maxMembersShown?: number;
}> = ({ membersMap, maxMembersShown = 4 }) => {
  const allPubKeys = Object.keys(membersMap).sort((a, b) =>
    (membersMap[a]?.Username || "").toLowerCase().localeCompare(
      (membersMap[b]?.Username || "").toLowerCase()
    )
  );
  const pubKeys = allPubKeys.slice(0, maxMembersShown);
  const hiddenMembersNum = allPubKeys.slice(maxMembersShown).length;

  return (
    <div className="flex justify-start ml-2">
      {pubKeys.map((pubKey) => (
        <div
          key={pubKey}
          title={membersMap[pubKey]?.Username || shortenLongWord(pubKey)}
        >
          <MessagingDisplayAvatar
            username={membersMap[pubKey]?.Username}
            publicKey={pubKey}
            diameter={26}
            classNames="-ml-2 pb-1"
            borderColor="border-black"
          />
        </div>
      ))}

      {hiddenMembersNum > 0 && (
        <div
          className="-ml-2 rounded-full bg-[#141c2b] border border-white/10 text-gray-400 w-[25px] h-[25px] text-center text-[10px] font-black flex items-center justify-center"
          title={`${hiddenMembersNum} members more in this group`}
        >
          +{hiddenMembersNum}
        </div>
      )}
    </div>
  );
};

export const ETHSection: FC<{
  desoPublicKey: string;
}> = ({ desoPublicKey }) => {
  const ethAddress = identity.desoAddressToEthereumAddress(desoPublicKey);

  return (
    <div className="relative inline-flex align-baseline font-sans text-[10px] font-bold uppercase center leading-none whitespace-nowrap py-1 px-2 rounded-lg select-none bg-white/5 text-gray-400 border border-white/10">
      <span>
        ETH
        <i className="ml-1">{shortenLongWord(ethAddress, 3, 3)}</i>
      </span>
    </div>
  );
};
