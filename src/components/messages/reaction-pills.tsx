import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatedEmoji } from "./animated-emoji";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import { ReactionDetailView } from "./reaction-detail-view";
import { useMobile } from "../../hooks/useMobile";

/** Track whether a long-press just fired so we can suppress the subsequent click */
let longPressDidFire = false;

interface ReactionPillsProps {
  reactions: Record<string, string[]>; // emoji -> list of public keys
  currentUserKey?: string;
  /** Whether this message was sent by the current user (affects popover alignment) */
  isSender?: boolean;
  /** Called when user clicks a pill they have NOT reacted to (adds reaction) */
  onReactionClick?: (emoji: string) => void;
  /** Explicit remove from the detail view ✕ button */
  onRemoveReaction?: (emoji: string) => void;
  getUsernameByPublicKey?: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
}

export const ReactionPills = ({
  reactions,
  currentUserKey,
  isSender,
  onReactionClick,
  onRemoveReaction,
  getUsernameByPublicKey,
  profilePicByPublicKey,
}: ReactionPillsProps) => {
  const entries = Object.entries(reactions).filter(
    ([, keys]) => keys.length > 0
  );
  const [showDetail, setShowDetail] = useState(false);
  const [tooltipEmoji, setTooltipEmoji] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isMobile } = useMobile();

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      clearTooltipTimer();
    },
    [clearTimer, clearTooltipTimer]
  );

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 relative">
      {entries.map(([emoji, keys]) => {
        const isOwnReaction = currentUserKey && keys.includes(currentUserKey);
        // Show up to 3 mini avatars
        const avatarKeys = keys.slice(0, 3);

        return (
          <div key={emoji} className="relative">
            <button
              onClick={() => {
                if (longPressDidFire) {
                  longPressDidFire = false;
                  return;
                }
                if (isMobile) {
                  // Mobile: always open detail view on tap (no right-click
                  // available). Users add reactions from the quick bar,
                  // remove via ✕ in the detail sheet.
                  setShowDetail(true);
                } else {
                  // Desktop: toggle (add or remove via onReact logic).
                  // Detail view is available via right-click.
                  onReactionClick?.(emoji);
                }
              }}
              onContextMenu={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  setTooltipEmoji(null);
                  clearTooltipTimer();
                  setShowDetail(true);
                }
              }}
              onTouchStart={() => {
                clearTimer();
                longPressDidFire = false;
                longPressTimer.current = setTimeout(() => {
                  longPressTimer.current = null;
                  longPressDidFire = true;
                  if (navigator.vibrate) navigator.vibrate(10);
                  setShowDetail(true);
                }, 400);
              }}
              onTouchMove={clearTimer}
              onTouchEnd={clearTimer}
              onMouseEnter={() => {
                if (isMobile) return;
                clearTooltipTimer();
                tooltipTimer.current = setTimeout(() => {
                  setTooltipEmoji(emoji);
                }, 300);
              }}
              onMouseLeave={() => {
                clearTooltipTimer();
                setTooltipEmoji(null);
              }}
              className={`flex items-center gap-1 pl-1.5 pr-2 h-[26px] rounded-full text-xs cursor-pointer transition-colors ${
                isOwnReaction
                  ? "glass-pill-active"
                  : "glass-pill hover:bg-white/[0.08]"
              }`}
            >
              <AnimatedEmoji emoji={emoji} size={18} />
              {/* Mini avatar stack */}
              <div className="flex -space-x-1.5">
                {avatarKeys.map((pk) => (
                  <div
                    key={pk}
                    className="rounded-full ring-1 ring-[#141c2b] overflow-hidden"
                    title={getUsernameByPublicKey?.[pk] || pk.slice(0, 8)}
                  >
                    <MessagingDisplayAvatar
                      publicKey={pk}
                      username={getUsernameByPublicKey?.[pk]}
                      extraDataPicUrl={profilePicByPublicKey?.[pk]}
                      diameter={16}
                      disableLink
                    />
                  </div>
                ))}
              </div>
              {keys.length > 3 && (
                <span className="text-gray-400 text-[10px]">
                  +{keys.length - 3}
                </span>
              )}
            </button>

            {/* Desktop hover tooltip — shows username + emoji per line */}
            {!isMobile && tooltipEmoji === emoji && !showDetail && (
              <div
                className={`absolute bottom-full mb-1.5 z-20 bg-[#0d1520] border border-white/[0.08] rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none animate-[fadeIn_100ms_ease-out] ${
                  isSender ? "right-0" : "left-0"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  {keys.slice(0, 5).map((pk) => {
                    const name =
                      pk === currentUserKey
                        ? "You"
                        : getUsernameByPublicKey?.[pk] || pk.slice(0, 8);
                    return (
                      <div
                        key={pk}
                        className="flex items-center gap-1.5 text-xs text-gray-300 whitespace-nowrap"
                      >
                        <span className="truncate max-w-[140px]">{name}</span>
                        <AnimatedEmoji emoji={emoji} size={13} />
                      </div>
                    );
                  })}
                  {keys.length > 5 && (
                    <span className="text-[10px] text-gray-500">
                      +{keys.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Detail view — bottom sheet (mobile) or popover (desktop) */}
      {showDetail && (
        <ReactionDetailView
          reactions={reactions}
          currentUserKey={currentUserKey}
          isSender={isSender}
          getUsernameByPublicKey={getUsernameByPublicKey}
          profilePicByPublicKey={profilePicByPublicKey}
          onRemoveReaction={onRemoveReaction}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
};
