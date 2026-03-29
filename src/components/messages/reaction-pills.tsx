import { AnimatedEmoji } from "./animated-emoji";

interface ReactionPillsProps {
  reactions: Record<string, string[]>; // emoji -> list of public keys
  currentUserKey?: string;
  onReactionClick?: (emoji: string) => void;
}

export const ReactionPills = ({
  reactions,
  currentUserKey,
  onReactionClick,
}: ReactionPillsProps) => {
  const entries = Object.entries(reactions).filter(([_, keys]) => keys.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 -mt-1.5 relative z-10">
      {entries.map(([emoji, keys]) => {
        const isOwnReaction = currentUserKey && keys.includes(currentUserKey);
        return (
          <button
            key={emoji}
            onClick={() => onReactionClick?.(emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
              isOwnReaction
                ? "bg-[#0d2818] border border-[#34F080]/40"
                : "bg-[#141c2b]/90 backdrop-blur-sm border border-white/10 hover:bg-white/10"
            }`}
          >
            <AnimatedEmoji emoji={emoji} size={18} />
            {keys.length > 1 && (
              <span className="text-gray-400">{keys.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
