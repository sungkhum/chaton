import { Smile } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { EmojiPicker } from "frimousse";

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPickerButton = ({ onEmojiSelect }: EmojiPickerButtonProps) => {
  const [open, setOpen] = useState(false);
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
          <EmojiPicker.Root
            onEmojiSelect={(emoji: { emoji: string }) => {
              onEmojiSelect(emoji.emoji);
              setOpen(false);
            }}
            className="w-[352px] h-[435px] bg-[#0a1628] rounded-xl border border-blue-800/40 [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.blue.800/40%)]"
          >
            <EmojiPicker.Search
              className="mx-2 mt-2 mb-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#34F080]/50"
              placeholder="Search emoji..."
            />
            <EmojiPicker.Viewport
              className="flex-1 overflow-y-auto px-1"
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
                  Emoji: ({ className: cls, ...props }) => (
                    <button
                      {...props}
                      className={`${cls || ""} flex items-center justify-center w-9 h-9 rounded-md text-xl hover:bg-white/10 cursor-pointer transition-colors`}
                    />
                  ),
                  CategoryHeader: ({ category, className: cls, ...props }) => (
                    <div {...props} className={`${cls || ""} px-2 py-1.5 text-xs font-semibold text-white/40 sticky top-0 bg-[#0a1628] z-10`}>
                      {category.label}
                    </div>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </div>
      )}
    </div>
  );
};
