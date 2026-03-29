import { ChatType, identity, ProfileEntryResponse } from "deso-protocol";
import { FC, useState } from "react";
import {
  MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN,
  MAX_MEMBERS_TO_REQUEST_IN_GROUP,
} from "../utils/constants";
import { getChatNameFromConversation } from "../utils/helpers";
import { ConversationMap } from "../utils/types";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessagingStartNewConversation } from "./messaging-start-new-conversation";
import { shortenLongWord } from "./search-users";
import { SaveToClipboard } from "./shared/save-to-clipboard";
import { StartGroupChat } from "./start-group-chat";

export const MessagingConversationAccount: FC<{
  conversations: ConversationMap;
  getUsernameByPublicKeyBase58Check: { [key: string]: string };
  selectedConversationPublicKey: string;
  onClick: (publicKey: string) => void;
  rehydrateConversation: (publicKey?: string) => void;
  membersByGroupKey: {
    [groupKey: string]: { [publicKey: string]: ProfileEntryResponse | null };
  };
}> = ({
  conversations,
  getUsernameByPublicKeyBase58Check,
  selectedConversationPublicKey,
  onClick,
  rehydrateConversation,
  membersByGroupKey,
}) => {
  const [activeTab, setActiveTab] = useState<"chats" | "requests">("chats");

  return (
    <div className="h-full rounded-md rounded-r-none">
      <div className="m-0">
        <StartGroupChat onSuccess={rehydrateConversation} />
      </div>

      <MessagingStartNewConversation
        rehydrateConversation={rehydrateConversation}
      />

      <div className="h-full max-h-[calc(100%-144px)]">
        {/* Tab Header */}
        <div className="flex bg-white/3 py-1.5 px-3 mx-3 rounded-xl">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "chats" ? "bg-[#34F080]/15 text-[#34F080]" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "requests" ? "bg-[#34F080]/15 text-[#34F080]" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Requests
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-[calc(100%-50px)] relative py-4">
          {activeTab === "chats" && (
            <div className="conversations-list overflow-y-auto max-h-full custom-scrollbar">
              <div className="h-full">
                {Object.entries(conversations)
                  .sort(([aPub, convoA], [bPub, convoB]) => {
                    if (convoA.messages.length === 0) {
                      return aPub === selectedConversationPublicKey ? -1 : 1;
                    }
                    if (convoB.messages.length === 0) {
                      return bPub === selectedConversationPublicKey ? 1 : -1;
                    }
                    return (
                      convoB.messages[0].MessageInfo.TimestampNanos -
                      convoA.messages[0].MessageInfo.TimestampNanos
                    );
                  })
                  .map(([key, value]) => {
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
                        ? "selected-conversation bg-white/5 border-l-2 border-[#34F080]"
                        : "border-l-2 border-transparent";
                    return (
                      <div
                        onClick={() => onClick(key)}
                        className={`px-3 py-3 ${selectedConversationStyle} hover:bg-white/5 cursor-pointer flex justify-start transition-colors`}
                        key={`message-thread-${key}`}
                      >
                        <MessagingDisplayAvatar
                          username={isDM ? chatName : undefined}
                          publicKey={isDM ? value.firstMessagePublicKey : chatName || ""}
                          groupChat={isGroupChat}
                          diameter={44}
                          classNames="mx-2"
                        />
                        <div className="w-[calc(100%-70px)] text-left">
                          <header className="flex items-center justify-between">
                            <div className="text-left ml-2 text-white font-semibold text-sm">
                              {isDM && chatName ? "@" : ""}
                              {shortenLongWord(chatName, 7, 7) ||
                                shortenLongWord(publicKey)}
                            </div>

                            {isDM && (
                              <ETHSection desoPublicKey={publicKey} />
                            )}

                            {isGroupChat && (
                              <MessagingGroupMembers
                                membersMap={membersByGroupKey[key] || {}}
                              />
                            )}
                          </header>

                          {value.messages[0] && (
                            <div className="text-left break-all truncate w-full text-gray-500 text-sm ml-2">
                              {value.messages[0].DecryptedMessage.slice(0, 50)}...
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div>
              <h2 className="text-white font-semibold text-2xl mt-5 mb-2">
                Coming soon!
              </h2>
              <div className="text-gray-500 text-base px-6">
                An on-chain message request & approval flow will be launching
                soon.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MessagingGroupMembers: FC<{
  membersMap: { [publicKey: string]: ProfileEntryResponse | null };
  maxMembersShown?: number;
}> = ({ membersMap, maxMembersShown = MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN }) => {
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
          {hiddenMembersNum > MAX_MEMBERS_TO_REQUEST_IN_GROUP
            ? `>${MAX_MEMBERS_TO_REQUEST_IN_GROUP}`
            : `+${hiddenMembersNum}`}
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
      <SaveToClipboard text={ethAddress}>
        ETH
        <i className="ml-1">{shortenLongWord(ethAddress, 3, 3)}</i>
      </SaveToClipboard>
    </div>
  );
};
