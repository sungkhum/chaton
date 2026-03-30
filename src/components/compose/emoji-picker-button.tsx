import { Smile } from "lucide-react";
import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { AnimatedEmoji } from "../messages/animated-emoji";

// bundle-conditional: frimousse only loads when user clicks "Search all emoji..."
const LazyFullEmojiPicker = lazy(() =>
  import("./full-emoji-picker").then(m => ({ default: m.FullEmojiPicker }))
);

const POPULAR_EMOJI = [
  "😀", "😂", "🥹", "❤️", "🔥", "👍", "👎", "🙏",
  "😭", "😍", "🥰", "😘", "😎", "🤔", "😱", "😡",
  "👀", "💯", "🎉", "✨", "💀", "🤣", "😊", "🥺",
  "😤", "🫠", "🤩", "😈", "💔", "🙌", "👏", "🫡",
];

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerButton = ({ onEmojiSelect }: EmojiPickerButtonProps) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setShowAll(false);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-gray-500 hover:text-[#34F080] transition-colors cursor-pointer"
        title="Emoji"
        type="button"
      >
        <Smile className="w-[18px] h-[18px]" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50">
          {showAll ? (
            <Suspense fallback={
              <div className="w-[352px] h-[435px] flex items-center justify-center bg-[#0a1628] rounded-xl border border-blue-800/40 text-blue-400/40 text-sm">
                Loading...
              </div>
            }>
              <LazyFullEmojiPicker
                onEmojiSelect={onEmojiSelect}
                onClose={() => setOpen(false)}
              />
            </Suspense>
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
                    className="flex items-center justify-center w-[33px] h-[33px] rounded-md hover:bg-white/10 cursor-pointer transition-colors"
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
      )}
    </div>
  );
};
