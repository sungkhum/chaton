import { Smile } from "lucide-react";
import { lazy, Suspense, useState, useRef, useEffect } from "react";

const Picker = lazy(() => import("@emoji-mart/react"));
import data from "@emoji-mart/data";

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
          <Suspense
            fallback={
              <div className="w-[352px] h-[435px] bg-[#0a1628] rounded-xl border border-blue-800/40 flex items-center justify-center">
                <div className="text-blue-400/40 text-sm">Loading...</div>
              </div>
            }
          >
            <Picker
              data={data}
              onEmojiSelect={(emoji: any) => {
                onEmojiSelect(emoji.native);
                setOpen(false);
              }}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="search"
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};
