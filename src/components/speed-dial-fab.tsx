import { MessageSquarePlus, Plus, Users, X } from "lucide-react";
import { FC, useState } from "react";

export const SpeedDialFab: FC<{
  onNewMessage: () => void;
  onNewGroup: () => void;
}> = ({ onNewMessage, onNewGroup }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-3 md:hidden">
        {expanded && (
          <>
            <button
              onClick={() => {
                setExpanded(false);
                onNewGroup();
              }}
              className="flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full bg-[#141c2b]/90 backdrop-blur-xl border border-white/10 text-white text-sm font-semibold shadow-lg cursor-pointer animate-[fab-expand_0.2s_ease-out]"
            >
              <Users className="w-4.5 h-4.5 text-[#34F080]" />
              New Group
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                onNewMessage();
              }}
              className="flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full bg-[#141c2b]/90 backdrop-blur-xl border border-white/10 text-white text-sm font-semibold shadow-lg cursor-pointer animate-[fab-expand_0.15s_ease-out]"
            >
              <MessageSquarePlus className="w-4.5 h-4.5 text-[#34F080]" />
              New Message
            </button>
          </>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-14 h-14 rounded-full glass-fab flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-[0.96]"
        >
          {expanded ? (
            <X className="w-6 h-6 text-[#34F080]" />
          ) : (
            <Plus className="w-6 h-6 text-[#34F080]" />
          )}
        </button>
      </div>
    </>
  );
};
