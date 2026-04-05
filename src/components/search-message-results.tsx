import { ChatType } from "deso-protocol";
import { Loader2 } from "lucide-react";
import { FC, ReactNode } from "react";
import {
  MessageSearchResult,
  SearchProgress,
} from "../services/message-search.service";
import { SearchMenuItem } from "../utils/search-helpers";
import { MSG_FILE_NAME, MSG_GIF_TITLE } from "../utils/extra-data";
import { formatRelativeTimestamp } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";

function highlightMatch(text: string, query: string): ReactNode {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return truncateAround(text, 0, 70);

  const contextBefore = 30;
  const contextAfter = 40;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(text.length, idx + query.length + contextAfter);

  const before = text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, end);

  return (
    <>
      {start > 0 && "..."}
      {before}
      <mark className="bg-[#34F080]/20 text-[#34F080] rounded-sm px-0.5">
        {match}
      </mark>
      {after}
      {end < text.length && "..."}
    </>
  );
}

function truncateAround(text: string, start: number, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const end = Math.min(text.length, start + maxLen);
  const s = Math.max(0, end - maxLen);
  return (
    (s > 0 ? "..." : "") + text.slice(s, end) + (end < text.length ? "..." : "")
  );
}

/** Build the same searchable text the service uses, so highlights match. */
function getDisplayText(msg: MessageSearchResult["message"]): string {
  const text = msg.DecryptedMessage || "";
  const extra = msg.MessageInfo?.ExtraData || {};
  const parts = [text];
  if (extra[MSG_FILE_NAME]) parts.push(extra[MSG_FILE_NAME]);
  if (extra[MSG_GIF_TITLE]) parts.push(extra[MSG_GIF_TITLE]);
  return parts.join(" ");
}

export const SearchMessageResults: FC<{
  results: MessageSearchResult[];
  query: string;
  isSearching: boolean;
  isDeepSearching: boolean;
  progress: SearchProgress | null;
  onSelectResult: (conversationKey: string) => void;
  userResults?: SearchMenuItem[];
  onUserSelected?: (item: SearchMenuItem) => void;
}> = ({
  results,
  query,
  isSearching,
  isDeepSearching,
  progress,
  onSelectResult,
  userResults = [],
  onUserSelected,
}) => {
  return (
    <div className="overflow-y-auto max-h-full custom-scrollbar pb-24">
      {/* Section header */}
      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Messages
      </div>

      {/* Loading state — initial cache search */}
      {isSearching && results.length === 0 && (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={16} />
          Searching...
        </div>
      )}

      {/* Results */}
      {results.map((result) => {
        const isDM = result.chatType === ChatType.DM;
        // For DMs, show the other party's avatar (conversation partner)
        const otherPartyKey = result.message.IsSender
          ? result.message.RecipientInfo.OwnerPublicKeyBase58Check
          : result.message.SenderInfo.OwnerPublicKeyBase58Check;

        return (
          <div key={result.message.MessageInfo.TimestampNanosString}>
            <div
              onClick={() => onSelectResult(result.conversationKey)}
              className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3"
            >
              <MessagingDisplayAvatar
                username={isDM ? result.conversationName : undefined}
                publicKey={isDM ? otherPartyKey : result.conversationName || ""}
                groupChat={!isDM}
                diameter={48}
              />

              <div className="flex-1 min-w-0">
                {/* Line 1: Conversation name + timestamp */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="truncate text-sm font-medium text-white">
                    {result.conversationName}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {formatRelativeTimestamp(result.timestamp)}
                  </span>
                </div>

                {/* Line 2: Message snippet with highlighted match */}
                <p className="text-sm text-gray-400 overflow-hidden whitespace-nowrap text-ellipsis">
                  {highlightMatch(getDisplayText(result.message), query)}
                </p>
              </div>
            </div>
            <div className="ml-[76px] border-b border-white/5" />
          </div>
        );
      })}

      {/* No results */}
      {!isSearching && !isDeepSearching && results.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No messages found
        </div>
      )}

      {/* Deep search progress */}
      {isDeepSearching && progress && (
        <div className="flex items-center justify-center py-4 text-gray-500 text-xs gap-2">
          <Loader2 className="animate-spin" size={14} />
          Searching {progress.completedConversations} of{" "}
          {progress.totalConversations} conversations...
        </div>
      )}

      {/* People section — DeSo user search results */}
      {userResults.length > 0 && (
        <>
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-white/5 mt-2">
            People
          </div>
          {userResults.map((item) => (
            <div
              key={item.id}
              onClick={() => onUserSelected?.(item)}
              className="px-4 py-2.5 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
            >
              <MessagingDisplayAvatar
                username={item.profile?.Username}
                publicKey={item.id}
                diameter={40}
              />
              <span className="text-sm text-white font-medium">
                {item.text}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
