/* eslint-disable react/prop-types */
import { EmojiPicker } from "frimousse";
import { useCallback, useRef, useState } from "react";

const POPULAR_EMOJI = [
  "😀",
  "😂",
  "🥹",
  "❤️",
  "🔥",
  "👍",
  "👎",
  "🙏",
  "😭",
  "😍",
  "🥰",
  "😘",
  "😎",
  "🤔",
  "😱",
  "😡",
  "👀",
  "💯",
  "🎉",
  "✨",
  "💀",
  "🤣",
  "😊",
  "🥺",
  "😏",
  "🫠",
  "🤗",
  "🤩",
  "😤",
  "🥳",
  "😈",
  "👻",
  "🫶",
  "🤝",
  "✌️",
  "🤞",
  "💪",
  "👏",
  "🙌",
  "💅",
  "❤️‍🔥",
  "💔",
  "💕",
  "⭐",
  "🌈",
  "☀️",
  "🍕",
  "🎶",
];

interface ReactionEmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
  searchClassName?: string;
  emojiSize?: string;
  categoryBg?: string;
  autoFocusSearch?: boolean;
}

export function ReactionEmojiPicker({
  onSelect,
  className = "w-[352px] h-[300px] flex flex-col overflow-hidden bg-[#141c2b] rounded-xl border border-white/10 [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.white/10%)]",
  searchClassName = "mx-2 mt-2 mb-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#34F080]/50",
  emojiSize = "w-9 h-9 text-xl",
  categoryBg = "bg-[#141c2b]",
  autoFocusSearch = true,
}: ReactionEmojiPickerProps) {
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // iOS WebKit "ghost focus" bug: frimousse processes each keystroke async
  // (rAF store flush + requestIdleCallback emoji filtering) and mutates the
  // emoji grid DOM. This causes iOS to disconnect the keyboard from the
  // focused search input — activeElement stays INPUT but keystrokes stop
  // being delivered. A blur+focus cycle reconnects the keyboard.
  //
  // Schedule a reconnect 300ms after EVERY keystroke (not just the first).
  // Each frimousse processing cycle takes ~200ms, so 300ms ensures we
  // reconnect after the DOM mutation settles.
  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    inputRef.current = input;
    const hasText = input.value.length > 0;
    setIsSearching(hasText);

    console.log("[emoji-search] onInput", { value: input.value, hasText });

    // Reconnect keyboard after frimousse's async DOM mutation
    setTimeout(() => {
      if (input.isConnected && document.activeElement === input) {
        console.log("[emoji-search] 300ms reconnect", { value: input.value });
        input.blur();
        input.focus({ preventScroll: true });
      }
    }, 300);
  }, []);

  return (
    <EmojiPicker.Root
      onEmojiSelect={(emoji: { emoji: string }) => onSelect(emoji.emoji)}
      className={className}
    >
      <EmojiPicker.Search
        className={searchClassName}
        placeholder="Search emoji..."
        autoFocus={autoFocusSearch}
        onInput={handleInput}
        onFocus={() => console.log("[emoji-search] onFocus")}
        onBlur={() =>
          console.log("[emoji-search] onBlur", {
            activeEl: document.activeElement?.tagName,
          })
        }
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          console.log("[emoji-search] keydown", {
            key: e.key,
            value: (e.target as HTMLInputElement).value,
            activeIsSelf: document.activeElement === e.target,
          });
        }}
      />
      <div className="relative flex-1 min-h-0">
        {/* Frimousse search results — hidden until user types */}
        <EmojiPicker.Viewport
          className={`absolute inset-0 overflow-y-auto px-1 transition-opacity duration-150 ${
            isSearching ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <EmojiPicker.Loading className="flex items-center justify-center h-full text-blue-400/40 text-sm">
            Loading...
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="flex items-center justify-center h-full text-white/40 text-sm">
            No emoji found
          </EmojiPicker.Empty>
          <EmojiPicker.List
            components={{
              Row: ({ className: cls, ...props }) => (
                <div {...props} className={`${cls || ""} flex gap-0.5 px-1`} />
              ),
              Emoji: ({ className: cls, emoji: emojiData, ...props }) => (
                <button
                  {...props}
                  className={`${
                    cls || ""
                  } flex items-center justify-center ${emojiSize} rounded-md hover:bg-white/10 cursor-pointer transition-colors`}
                >
                  {emojiData.emoji}
                </button>
              ),
              CategoryHeader: ({ category, className: cls, ...props }) => (
                <div
                  {...props}
                  className={`${
                    cls || ""
                  } px-2 py-1.5 text-xs font-semibold text-white/40 sticky top-0 ${categoryBg} z-10`}
                >
                  {category.label}
                </div>
              ),
            }}
          />
        </EmojiPicker.Viewport>

        {/* Popular emojis — visible when search is empty */}
        <div
          className={`absolute inset-0 overflow-y-auto px-2 transition-opacity duration-150 ${
            isSearching ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div
            className={`px-1 py-1.5 text-xs font-semibold text-white/40 sticky top-0 ${categoryBg} z-10`}
          >
            Popular
          </div>
          <div className="flex flex-wrap gap-0.5 px-0.5">
            {POPULAR_EMOJI.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className={`flex items-center justify-center ${emojiSize} rounded-md hover:bg-white/10 cursor-pointer transition-colors`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </EmojiPicker.Root>
  );
}
