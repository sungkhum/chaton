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
  // iOS WebKit disconnects the keyboard from inputs inside position:fixed
  // containers when sibling DOM nodes mutate (frimousse re-renders the emoji
  // grid on each keystroke via requestIdleCallback). The input retains
  // document.activeElement but keystrokes stop being delivered.
  //
  // Fix: use a NATIVE input for typing (outside frimousse's mutating tree)
  // and a hidden controlled EmojiPicker.Search to drive frimousse's filter.
  // The native input never has DOM mutations near it, so iOS keeps the
  // keyboard connected.
  const [search, setSearch] = useState("");
  const isSearching = search.length > 0;
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const handleNativeInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      setSearch((e.target as HTMLInputElement).value);
    },
    []
  );

  return (
    <EmojiPicker.Root
      onEmojiSelect={(emoji: { emoji: string }) => onSelect(emoji.emoji)}
      className={className}
    >
      {/* Native input for typing — immune to iOS keyboard disconnect */}
      <input
        ref={nativeInputRef}
        className={searchClassName}
        placeholder="Search emoji..."
        autoFocus={autoFocusSearch}
        onInput={handleNativeInput}
        type="search"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
      />
      {/* Hidden frimousse Search — controlled by native input value,
          drives the emoji filtering without being focused */}
      <EmojiPicker.Search
        value={search}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
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
