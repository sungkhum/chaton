import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatedEmoji } from "./animated-emoji";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import { useMobile } from "../../hooks/useMobile";

/** Track whether a long-press just fired so we can suppress the subsequent click */
let longPressDidFire = false;

interface ReactionPillsProps {
  reactions: Record<string, string[]>; // emoji -> list of public keys
  currentUserKey?: string;
  onReactionClick?: (emoji: string) => void;
  getUsernameByPublicKey?: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
}

export const ReactionPills = ({
  reactions,
  currentUserKey,
  onReactionClick,
  getUsernameByPublicKey,
  profilePicByPublicKey,
}: ReactionPillsProps) => {
  const entries = Object.entries(reactions).filter(([_, keys]) => keys.length > 0);
  const [popupEmoji, setPopupEmoji] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isMobile } = useMobile();

  // Close popup on click outside
  useEffect(() => {
    if (!popupEmoji) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupEmoji(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popupEmoji]);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
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
                onReactionClick?.(emoji);
              }}
              onContextMenu={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  setPopupEmoji(popupEmoji === emoji ? null : emoji);
                }
              }}
              onTouchStart={() => {
                clearTimer();
                longPressDidFire = false;
                longPressTimer.current = setTimeout(() => {
                  longPressTimer.current = null;
                  longPressDidFire = true;
                  if (navigator.vibrate) navigator.vibrate(10);
                  setPopupEmoji(popupEmoji === emoji ? null : emoji);
                }, 400);
              }}
              onTouchMove={clearTimer}
              onTouchEnd={clearTimer}
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
                  <div key={pk} className="rounded-full ring-1 ring-[#141c2b] overflow-hidden">
                    <MessagingDisplayAvatar
                      publicKey={pk}
                      username={getUsernameByPublicKey?.[pk]}
                      extraDataPicUrl={profilePicByPublicKey?.[pk]}
                      diameter={16}
                    />
                  </div>
                ))}
              </div>
              {keys.length > 3 && (
                <span className="text-gray-400 text-[10px]">+{keys.length - 3}</span>
              )}
            </button>

            {/* Who reacted popup */}
            {popupEmoji === emoji && (
              <div
                ref={popupRef}
                className="absolute bottom-full mb-1 left-0 z-20 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg py-1.5 min-w-[160px] max-h-[200px] overflow-y-auto"
              >
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Reacted with <AnimatedEmoji emoji={emoji} size={12} />
                </div>
                {keys.map((pk) => {
                  const username = getUsernameByPublicKey?.[pk];
                  return (
                    <div
                      key={pk}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5"
                    >
                      <MessagingDisplayAvatar
                        publicKey={pk}
                        username={username}
                        extraDataPicUrl={profilePicByPublicKey?.[pk]}
                        diameter={24}
                      />
                      <span className="text-sm text-gray-200 truncate">
                        {username ? username : `${pk.slice(0, 8)}...`}
                      </span>
                      {pk === currentUserKey && (
                        <span className="text-[10px] text-[#34F080] ml-auto">you</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
