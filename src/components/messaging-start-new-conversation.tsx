import { FC } from "react";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../utils/constants";
import { SearchUsers } from "./search-users";

export const MessagingStartNewConversation: FC<{
  rehydrateConversation: (publicKey: string, autoScroll?: boolean) => void;
}> = ({ rehydrateConversation }) => {
  return (
    <div>
      <div className="m-4">
        <SearchUsers
          onSelected={async (e) => {
            if (!e) {
              return;
            }
            await rehydrateConversation(
              e?.id + DEFAULT_KEY_MESSAGING_GROUP_NAME,
              true
            );
          }}
          placeholder="Search conversations..."
          className="search-conversations-input text-white placeholder:text-gray-500 bg-white/5 border border-white/8 hover:border-[#34F080]/30 rounded-xl"
        />
      </div>
    </div>
  );
};
