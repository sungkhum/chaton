import { FC } from "react";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../utils/constants";
import { SearchUsers } from "./search-users";

export const MessagingStartNewConversation: FC<{
  rehydrateConversation: (publicKey: string, autoScroll?: boolean) => void;
  onSearchQueryChange?: (query: string) => void;
  clearTrigger?: number;
}> = ({ rehydrateConversation, onSearchQueryChange, clearTrigger }) => {
  return (
    <div>
      <div className="m-4">
        <SearchUsers
          onSelected={async (e) => {
            if (!e) {
              return;
            }
            onSearchQueryChange?.("");
            await rehydrateConversation(
              e?.id + DEFAULT_KEY_MESSAGING_GROUP_NAME,
              true
            );
          }}
          onChange={onSearchQueryChange}
          clearTrigger={clearTrigger}
          placeholder="Search conversations..."
          className="search-conversations-input text-white placeholder:text-gray-500 bg-white/5 border border-white/8 hover:border-[#34F080]/30 rounded-xl"
        />
      </div>
    </div>
  );
};
