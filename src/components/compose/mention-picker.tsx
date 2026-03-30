import { useEffect, useRef } from "react";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";

export interface MentionCandidate {
  publicKey: string;
  username: string;
}

interface MentionPickerProps {
  candidates: MentionCandidate[];
  query: string;
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
}

export const MentionPicker = ({
  candidates,
  query,
  selectedIndex,
  onSelect,
}: MentionPickerProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = candidates.filter((c) =>
    c.username.toLowerCase().includes(query.toLowerCase())
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-[#141c2b] border border-white/10 rounded-xl shadow-lg max-h-[200px] overflow-y-auto z-50"
    >
      {filtered.map((c, i) => (
        <button
          key={c.publicKey}
          onMouseDown={(e) => {
            e.preventDefault(); // Keep textarea focus
            onSelect(c);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
            i === selectedIndex
              ? "bg-white/10 text-white"
              : "text-gray-300 hover:bg-white/5"
          }`}
        >
          <MessagingDisplayAvatar
            publicKey={c.publicKey}
            username={c.username}
            diameter={28}
          />
          <span className="truncate font-medium">{c.username}</span>
        </button>
      ))}
    </div>
  );
};
