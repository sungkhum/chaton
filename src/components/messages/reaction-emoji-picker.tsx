import { EmojiPicker } from "frimousse";

interface ReactionEmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
  searchClassName?: string;
  emojiSize?: string;
  categoryBg?: string;
}

export function ReactionEmojiPicker({
  onSelect,
  className = "w-[352px] h-[300px] flex flex-col overflow-hidden bg-[#141c2b] rounded-xl border border-white/10 [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.white/10%)]",
  searchClassName = "mx-2 mt-2 mb-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#34F080]/50",
  emojiSize = "w-9 h-9 text-xl",
  categoryBg = "bg-[#141c2b]",
}: ReactionEmojiPickerProps) {
  return (
    <EmojiPicker.Root
      onEmojiSelect={(emoji: { emoji: string }) => onSelect(emoji.emoji)}
      className={className}
    >
      <EmojiPicker.Search
        className={searchClassName}
        placeholder="Search emoji..."
        autoFocus
      />
      <EmojiPicker.Viewport className="flex-1 overflow-y-auto px-1">
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
                className={`${cls || ""} flex items-center justify-center ${emojiSize} rounded-md hover:bg-white/10 cursor-pointer transition-colors`}
              >
                {emojiData.emoji}
              </button>
            ),
            CategoryHeader: ({ category, className: cls, ...props }) => (
              <div
                {...props}
                className={`${cls || ""} px-2 py-1.5 text-xs font-semibold text-white/40 sticky top-0 ${categoryBg} z-10`}
              >
                {category.label}
              </div>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
