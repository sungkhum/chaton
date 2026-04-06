import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatedEmoji } from "./animated-emoji";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import { useMobile } from "../../hooks/useMobile";

interface ReactorEntry {
  publicKey: string;
  emojis: string[];
}

interface ReactionDetailViewProps {
  /** emoji -> list of public keys */
  reactions: Record<string, string[]>;
  currentUserKey?: string;
  /** Whether the reacted message was sent by the current user (affects popover alignment) */
  isSender?: boolean;
  getUsernameByPublicKey?: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
  onRemoveReaction?: (emoji: string) => void;
  onClose: () => void;
}

export const ReactionDetailView = ({
  reactions,
  currentUserKey,
  isSender,
  getUsernameByPublicKey,
  profilePicByPublicKey,
  onRemoveReaction,
  onClose,
}: ReactionDetailViewProps) => {
  const { isMobile } = useMobile();
  const emojis = Object.keys(reactions).filter((e) => reactions[e].length > 0);
  const showTabs = emojis.length > 1;
  const [activeTab, setActiveTab] = useState<string | null>(
    showTabs ? null : emojis[0] ?? null
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  // Build the list of reactors for the active tab
  const reactors: ReactorEntry[] = (() => {
    if (activeTab) {
      // Per-emoji tab: just show users who reacted with this emoji
      const keys = reactions[activeTab] || [];
      return keys.map((pk) => ({ publicKey: pk, emojis: [activeTab] }));
    }
    // "All" tab: show all users, with all their emojis
    const userEmojis: Record<string, string[]> = {};
    const order: string[] = [];
    for (const [emoji, keys] of Object.entries(reactions)) {
      for (const pk of keys) {
        if (!userEmojis[pk]) {
          userEmojis[pk] = [];
          order.push(pk);
        }
        if (!userEmojis[pk].includes(emoji)) {
          userEmojis[pk].push(emoji);
        }
      }
    }
    return order.map((pk) => ({ publicKey: pk, emojis: userEmojis[pk] }));
  })();

  const totalCount = Object.values(reactions).reduce(
    (sum, keys) => sum + keys.length,
    0
  );

  const animateClose = useCallback(() => {
    setClosing(true);
    const duration = isMobile ? 200 : 150;
    setTimeout(onClose, duration);
  }, [isMobile, onClose]);

  // Desktop: close on click outside
  useEffect(() => {
    if (isMobile) return;
    const handle = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        animateClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isMobile, animateClose]);

  // Desktop: close on Escape
  useEffect(() => {
    if (isMobile) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [isMobile, animateClose]);

  const tabBar = showTabs && (
    <div
      className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar"
      role="tablist"
      aria-label="Filter reactions by emoji"
    >
      {/* "All" tab */}
      <button
        role="tab"
        aria-selected={activeTab === null}
        onClick={() => setActiveTab(null)}
        className={`flex items-center gap-1 px-2.5 shrink-0 rounded-full text-xs font-medium transition-colors cursor-pointer ${
          isMobile ? "h-[30px]" : "h-[26px]"
        } ${
          activeTab === null
            ? "glass-pill-active text-[#34F080]"
            : "glass-pill text-gray-400 hover:bg-white/[0.08]"
        }`}
      >
        All
        <span className="text-[10px] opacity-70">{totalCount}</span>
      </button>
      {emojis.map((emoji) => (
        <button
          key={emoji}
          role="tab"
          aria-selected={activeTab === emoji}
          onClick={() => setActiveTab(emoji)}
          className={`flex items-center gap-1 px-2 shrink-0 rounded-full text-xs transition-colors cursor-pointer ${
            isMobile ? "h-[30px]" : "h-[26px]"
          } ${
            activeTab === emoji
              ? "glass-pill-active"
              : "glass-pill hover:bg-white/[0.08]"
          }`}
        >
          <AnimatedEmoji emoji={emoji} size={isMobile ? 16 : 14} />
          <span
            className={`text-[10px] ${
              activeTab === emoji ? "text-[#34F080]" : "text-gray-400"
            }`}
          >
            {reactions[emoji].length}
          </span>
        </button>
      ))}
    </div>
  );

  const reactorList = (
    <div
      role="tabpanel"
      className={`overflow-y-auto ${
        isMobile ? "max-h-[calc(50vh-80px)]" : "max-h-[220px]"
      }`}
    >
      {reactors.map(({ publicKey, emojis: userEmojis }) => {
        const username = getUsernameByPublicKey?.[publicKey];
        const isMe = publicKey === currentUserKey;
        return (
          <div
            key={publicKey + (activeTab || "all")}
            className={`group/row flex items-center gap-2.5 ${
              isMobile ? "px-4 py-2.5" : "px-3 py-1.5"
            } ${!isMobile ? "hover:bg-white/5" : ""} transition-colors`}
          >
            <MessagingDisplayAvatar
              publicKey={publicKey}
              username={username}
              extraDataPicUrl={profilePicByPublicKey?.[publicKey]}
              diameter={isMobile ? 28 : 24}
              disableLink
            />
            <span
              className={`text-sm text-gray-200 truncate ${
                isMe ? "flex-1 min-w-0" : "flex-1"
              }`}
            >
              {username || "Anonymous"}
            </span>
            {/* Emoji badges (in "All" tab, show which emojis this person used) */}
            {!activeTab && (
              <div className="flex gap-0.5 shrink-0">
                {userEmojis.map((emoji) => (
                  <AnimatedEmoji
                    key={emoji}
                    emoji={emoji}
                    size={isMobile ? 18 : 14}
                  />
                ))}
              </div>
            )}
            {isMe && (
              <span className="text-[10px] text-[#34F080] shrink-0">you</span>
            )}
            {isMe && onRemoveReaction && (
              <button
                onClick={() => {
                  // Remove reaction for the active tab emoji, or all emojis
                  if (activeTab) {
                    onRemoveReaction(activeTab);
                  } else {
                    // Remove all of this user's reactions
                    for (const emoji of userEmojis) {
                      onRemoveReaction(emoji);
                    }
                  }
                }}
                className={`shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer ${
                  isMobile
                    ? "p-1"
                    : "p-0.5 opacity-0 group-hover/row:opacity-100"
                }`}
                aria-label={`Remove your ${
                  activeTab || userEmojis.join(" ")
                } reaction`}
              >
                <X className={isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- Desktop: inline popover ---
  if (!isMobile) {
    return (
      <div
        ref={popoverRef}
        className={`absolute bottom-full mb-2 z-20 bg-[#1a2436] border border-white/10 rounded-xl shadow-xl shadow-black/30 py-2 min-w-[220px] max-w-[320px] ${
          isSender ? "right-0" : "left-0"
        } ${closing ? "reaction-detail-out" : "reaction-detail-in"}`}
      >
        {tabBar}
        {showTabs && <div className="h-px bg-white/5 mx-2 mb-1" />}
        {!showTabs && (
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            Reacted with <AnimatedEmoji emoji={emojis[0]} size={12} />
          </div>
        )}
        {reactorList}
      </div>
    );
  }

  // --- Mobile: bottom sheet via portal ---
  const portalTarget = document.querySelector(".App") || document.body;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/50 z-[60] ${
          closing
            ? "animate-[fadeOut_200ms_ease-out_both]"
            : "modal-backdrop-enter"
        }`}
        onClick={animateClose}
      />
      {/* Sheet */}
      <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
        <div
          className={`pointer-events-auto bg-[#0a1220] text-white w-full rounded-t-2xl border-t border-white/10 max-h-[50vh] flex flex-col ${
            closing
              ? "animate-[slideDown_200ms_ease-in_both]"
              : "animate-[slideUp_300ms_cubic-bezier(0.16,1,0.3,1)]"
          }`}
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Drag indicator */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-sm font-semibold text-gray-400">
              Reactions
            </span>
            <button
              onClick={animateClose}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {tabBar}
          {showTabs && <div className="h-px bg-white/5 mx-3" />}
          {!showTabs && (
            <div className="px-4 pb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              Reacted with <AnimatedEmoji emoji={emojis[0]} size={12} />
            </div>
          )}
          {reactorList}
        </div>
      </div>
    </>,
    portalTarget
  );
};
