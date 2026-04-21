import { Smile, X } from "lucide-react";
import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChunkErrorBoundary } from "../shared/chunk-error-boundary";
import { AnimatedEmoji } from "../messages/animated-emoji";
import { useMobile } from "../../hooks/useMobile";

// bundle-conditional: frimousse only loads when user clicks "Search all emoji..."
const LazyFullEmojiPicker = lazy(() =>
  import("./full-emoji-picker").then((m) => ({ default: m.FullEmojiPicker }))
);

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
  "😤",
  "🫠",
  "🤩",
  "😈",
  "💔",
  "🙌",
  "👏",
  "🫡",
];

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerButton = ({
  onEmojiSelect,
}: EmojiPickerButtonProps) => {
  const { isMobile } = useMobile();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobilePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobile) return; // mobile uses full-screen overlay with close button
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  useEffect(() => {
    if (!open) setShowAll(false);
  }, [open]);

  // Mobile: full-screen overlay portaled to .App — escapes the backdrop-filter
  // containing block from .glass-compose, while staying inside .App's keyboard-aware
  // layout (transform on .App makes fixed children respect --app-height).
  const mobilePortalTarget = isMobile
    ? document.querySelector(".App") || document.body
    : null;

  const mobileOverlay =
    open && isMobile && mobilePortalTarget
      ? createPortal(
          <div
            ref={mobilePickerRef}
            className="fixed inset-x-0 top-14 bottom-0 bg-[#0a1628] z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-blue-800/30">
              <span className="text-sm text-blue-100 font-medium">Emoji</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="cursor-pointer"
              >
                <X className="w-4 h-4 text-blue-400/60" />
              </button>
            </div>
            {showAll ? (
              <div className="flex-1 min-h-0 overflow-hidden overscroll-y-contain">
                <ChunkErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center text-blue-400/40 text-sm p-8">
                        Loading...
                      </div>
                    }
                  >
                    <LazyFullEmojiPicker
                      onEmojiSelect={(emoji) => {
                        onEmojiSelect(emoji);
                        setOpen(false);
                      }}
                      onClose={() => setOpen(false)}
                    />
                  </Suspense>
                </ChunkErrorBoundary>
              </div>
            ) : (
              <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-y-contain">
                <div className="grid grid-cols-8 gap-1 justify-items-center">
                  {POPULAR_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onEmojiSelect(emoji);
                        setOpen(false);
                      }}
                      className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors active:scale-[0.96]"
                    >
                      <AnimatedEmoji emoji={emoji} size={26} eager />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-white transition-colors text-center cursor-pointer border border-white/8 rounded-lg"
                >
                  Search all emoji...
                </button>
              </div>
            )}
          </div>,
          mobilePortalTarget
        )
      : null;

  // Desktop: absolute popover (no portal needed, no backdrop-filter issue at this breakpoint)
  const desktopPopover =
    open && !isMobile ? (
      <div className="absolute bottom-full mb-2 right-0 z-50">
        {showAll ? (
          <ChunkErrorBoundary>
            <Suspense
              fallback={
                <div className="w-[352px] h-[435px] flex items-center justify-center bg-[#0a1628] rounded-xl border border-blue-800/40 text-blue-400/40 text-sm">
                  Loading...
                </div>
              }
            >
              <LazyFullEmojiPicker
                onEmojiSelect={onEmojiSelect}
                onClose={() => setOpen(false)}
              />
            </Suspense>
          </ChunkErrorBoundary>
        ) : (
          <div className="bg-[#0a1628] rounded-xl border border-blue-800/40 p-2 w-[280px]">
            <div className="grid grid-cols-8 gap-0.5">
              {POPULAR_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onEmojiSelect(emoji);
                    setOpen(false);
                  }}
                  className="flex items-center justify-center w-[33px] h-[33px] rounded-md hover:bg-white/10 cursor-pointer transition-colors active:scale-[0.96]"
                >
                  <AnimatedEmoji emoji={emoji} size={22} eager />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAll(true)}
              className="w-full mt-1.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors text-center cursor-pointer"
            >
              Search all emoji...
            </button>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          // On mobile, dismiss the keyboard so the full-screen overlay gets max space
          if (opening && isMobile)
            (document.activeElement as HTMLElement)?.blur();
        }}
        className="p-2 text-gray-500 hover:text-[#34F080] transition-colors cursor-pointer"
        title="Emoji"
        type="button"
      >
        <Smile className="w-[18px] h-[18px]" />
      </button>
      {desktopPopover}
      {mobileOverlay}
    </div>
  );
};
