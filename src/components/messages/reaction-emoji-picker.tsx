/* eslint-disable react/prop-types */
import { EmojiPicker } from "frimousse";
import { useCallback, useRef } from "react";

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
  // Track searching state via ref + direct DOM manipulation instead of
  // useState to avoid a React re-render on the first keystroke. On iOS,
  // re-rendering sibling elements while the keyboard is open can cause
  // WebKit to drop focus from the search input.
  const searchingRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const hasText = input.value.length > 0;
    console.log("[emoji-search] onInput", {
      value: input.value,
      hasText,
      wasSearching: searchingRef.current,
      activeEl: document.activeElement?.tagName,
      activeIsSelf: document.activeElement === input,
    });
    if (hasText === searchingRef.current) return;
    searchingRef.current = hasText;
    const vp = viewportRef.current;
    const pop = popularRef.current;
    if (vp) {
      vp.style.visibility = hasText ? "visible" : "hidden";
      vp.style.zIndex = hasText ? "2" : "1";
    }
    if (pop) {
      pop.style.visibility = hasText ? "hidden" : "visible";
      pop.style.zIndex = hasText ? "2" : "1";
    }
    console.log("[emoji-search] after DOM toggle", {
      activeEl: document.activeElement?.tagName,
      activeIsSelf: document.activeElement === input,
    });
    // Schedule checks at multiple timings to catch async focus theft
    requestAnimationFrame(() => {
      console.log("[emoji-search] rAF after input", {
        activeEl: document.activeElement?.tagName,
        activeIsSelf: document.activeElement === input,
        activeClass: (document.activeElement as HTMLElement)?.className?.slice(
          0,
          60
        ),
      });
    });
    setTimeout(() => {
      console.log("[emoji-search] 100ms after input", {
        activeEl: document.activeElement?.tagName,
        activeIsSelf: document.activeElement === input,
        activeClass: (document.activeElement as HTMLElement)?.className?.slice(
          0,
          60
        ),
      });
    }, 100);
    setTimeout(() => {
      console.log("[emoji-search] 300ms after input", {
        activeEl: document.activeElement?.tagName,
        activeIsSelf: document.activeElement === input,
        activeClass: (document.activeElement as HTMLElement)?.className?.slice(
          0,
          60
        ),
      });
    }, 300);
  }, []);

  const handleFocus = useCallback(() => {
    console.log("[emoji-search] onFocus fired");
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const related = e.relatedTarget as HTMLElement | null;
    console.log("[emoji-search] onBlur", {
      relatedTag: related?.tagName || "null",
      relatedClass: related?.className?.slice(0, 60) || "null",
      activeEl: document.activeElement?.tagName,
    });
    requestAnimationFrame(() => {
      const active = document.activeElement;
      console.log("[emoji-search] onBlur rAF", {
        inputConnected: input.isConnected,
        activeEl: active?.tagName,
        activeClass: (active as HTMLElement)?.className?.slice(0, 60),
        isBody: active === document.body,
      });
      if (!input.isConnected) return;
      if (
        active === document.body ||
        active === document.documentElement ||
        active === null
      ) {
        console.log("[emoji-search] RESTORING FOCUS");
        input.focus({ preventScroll: true });
        console.log("[emoji-search] after restore", {
          activeEl: document.activeElement?.tagName,
          activeIsSelf: document.activeElement === input,
        });
      }
    });
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
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <div className="relative flex-1 min-h-0">
        {/* Frimousse search results — hidden until user types */}
        <EmojiPicker.Viewport
          ref={viewportRef}
          className="absolute inset-0 overflow-y-auto px-1 invisible z-[1]"
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
          ref={popularRef}
          className="absolute inset-0 overflow-y-auto px-2 visible z-[2]"
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
