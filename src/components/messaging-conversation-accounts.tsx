import { ChatType, identity, ProfileEntryResponse } from "deso-protocol";
import { Check, Users, X } from "lucide-react";
import { FC, useState } from "react";
import { formatRelativeTimestamp, getChatNameFromConversation } from "../utils/helpers";
import { Conversation, ConversationMap } from "../utils/types";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessagingStartNewConversation } from "./messaging-start-new-conversation";
import { shortenLongWord } from "./search-users";
import { SpeedDialFab } from "./speed-dial-fab";
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
  getUsernameByPublicKeyBase58Check: { [key: string]: string };
  selectedConversationPublicKey: string;
  onClick: (publicKey: string) => void;
  rehydrateConversation: (publicKey?: string) => void;
  onAccept: (conversationKey: string, publicKey: string) => void;
  onBlock: (conversationKey: string, publicKey: string) => void;
  unreadByConversation: Map<string, number>;
  membersByGroupKey: {
    [groupKey: string]: { [publicKey: string]: ProfileEntryResponse | null };
  };
}> = ({
  conversations,
  requestConversations,
  getUsernameByPublicKeyBase58Check,
  selectedConversationPublicKey,
  onClick,
  rehydrateConversation,
  onAccept,
  onBlock,
  unreadByConversation,
  membersByGroupKey,
}) => {
  const [activeTab, setActiveTab] = useState<"chats" | "requests">("chats");
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const requestCount = Object.keys(requestConversations).length;

  const handleNewMessage = () => {
    const input = document.querySelector<HTMLInputElement>(
      ".search-conversations-input input, .search-conversations-input"
    );
    input?.focus();
  };

  return (
    <div className="h-full rounded-md rounded-r-none relative">
      <StartGroupChat
        onSuccess={rehydrateConversation}
        open={groupChatOpen}
        onOpenChange={setGroupChatOpen}
      />

      <MessagingStartNewConversation
        rehydrateConversation={rehydrateConversation}
      />

      <div className="h-full max-h-[calc(100%-76px)]">
        {/* Tab Header — Underline Style */}
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
              {sortConversations(
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
                const selectedConversationStyle =
                  key === selectedConversationPublicKey
                    ? "selected-conversation bg-white/5"
                    : "";
                const unreadCount = unreadByConversation.get(key) || 0;
                const hasUnread = unreadCount > 0;
                const timestamp = value.messages[0]
                  ? formatRelativeTimestamp(value.messages[0].MessageInfo.TimestampNanos)
                  : "";
                const displayName =
                  shortenLongWord(chatName, 7, 7) || shortenLongWord(publicKey);

                return (
                  <div key={`message-thread-${key}`}>
                    <div
                      onClick={() => onClick(key)}
                      className={`px-4 py-3 ${selectedConversationStyle} hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors ${
                        hasUnread
                          ? "border-l-2 border-l-[#34F080] bg-[#34F080]/[0.04]"
                          : "border-l-2 border-l-transparent"
                      }`}
                    >
                      <MessagingDisplayAvatar
                        username={isDM ? chatName : undefined}
                        publicKey={isDM ? value.firstMessagePublicKey : chatName || ""}
                        groupChat={isGroupChat}
                        diameter={48}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Line 1: Name + Timestamp */}
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            {isGroupChat && (
                              <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                            <span
                              className={`truncate text-sm ${
                                hasUnread ? "text-white font-bold" : "text-white font-semibold"
                              }`}
                            >
                              {isDM && chatName ? "@" : ""}
                              {displayName}
                            </span>
                          </div>
                          <span
                            className={`text-xs shrink-0 ml-2 ${
                              hasUnread ? "text-[#34F080] font-bold" : "text-gray-500"
                            }`}
                          >
                            {timestamp}
                          </span>
                        </div>

                        {/* Line 2: Preview + Unread badge */}
                        <div className="flex items-center justify-between">
                          <p
                            className={`truncate text-sm ${
                              hasUnread ? "text-gray-200 font-medium" : "text-gray-500"
                            }`}
                          >
                            {value.messages[0]
                              ? value.messages[0].DecryptedMessage.slice(0, 60)
                              : ""}
                          </p>
                          {hasUnread && (
                            <span className="bg-[#34F080] text-black text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0 ml-2">
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
                                {chatName ? "@" : ""}
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

                        <div className="flex items-center gap-2 mt-2 ml-[60px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAccept(key, publicKey);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#34F080]/15 text-[#34F080] text-xs font-bold hover:bg-[#34F080]/25 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onBlock(key, publicKey);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-bold hover:bg-red-500/15 hover:text-red-400 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Block
                          </button>
                        </div>
                      </div>
                      <div className="ml-[76px] border-b border-white/5" />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedConversationPublicKey && (
        <SpeedDialFab
          onNewMessage={handleNewMessage}
          onNewGroup={() => setGroupChatOpen(true)}
        />
      )}
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
