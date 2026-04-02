import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CircleDollarSign } from "lucide-react";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import { useMobile } from "../../hooks/useMobile";
import { fetchExchangeRate, nanosToUsd, formatUsd } from "../../utils/exchange-rate";
import { formatDesoAmount } from "../../utils/helpers";

/** Track whether a long-press just fired so we can suppress the subsequent click */
let longPressDidFire = false;

interface TipEntry {
  senderPublicKey: string;
  amountNanos: number;
}

interface TipPillsProps {
  tips: TipEntry[];
  currentUserKey?: string;
  getUsernameByPublicKey?: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
}

export const TipPills = ({
  tips,
  currentUserKey,
  getUsernameByPublicKey,
  profilePicByPublicKey,
}: TipPillsProps) => {
  const [showPopup, setShowPopup] = useState(false);
  const [usdTotal, setUsdTotal] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isMobile } = useMobile();

  const totalNanos = tips.reduce((sum, t) => sum + t.amountNanos, 0);
  const uniqueTippers = useMemo(
    () => [...new Set(tips.map((t) => t.senderPublicKey))],
    [tips]
  );
  const tipperCount = uniqueTippers.length;
  const isOwnTip = tips.some((t) => t.senderPublicKey === currentUserKey);

  // Fetch USD conversion
  useEffect(() => {
    fetchExchangeRate().then((rate) => {
      setUsdTotal(formatUsd(nanosToUsd(totalNanos, rate)));
    }).catch(() => {});
  }, [totalNanos]);

  // Close popup on click outside
  useEffect(() => {
    if (!showPopup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopup]);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (tips.length === 0) return null;

  // Show up to 3 unique tipper avatars
  const avatarKeys = uniqueTippers.slice(0, 3);

  return (
    <div className="relative">
      <button
        aria-label={`Tips totaling ${usdTotal ?? "..."} from ${tipperCount} ${tipperCount === 1 ? "person" : "people"}`}
        onClick={() => {
          if (longPressDidFire) {
            longPressDidFire = false;
            return;
          }
        }}
        onContextMenu={(e) => {
          if (!isMobile) {
            e.preventDefault();
            setShowPopup(!showPopup);
          }
        }}
        onTouchStart={() => {
          clearTimer();
          longPressDidFire = false;
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            longPressDidFire = true;
            if (navigator.vibrate) navigator.vibrate(10);
            setShowPopup(!showPopup);
          }, 400);
        }}
        onTouchMove={clearTimer}
        onTouchEnd={clearTimer}
        className={`flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
          isOwnTip
            ? "bg-[#34F080]/15 border border-[#34F080]/40"
            : "bg-[#34F080]/10 border border-[#34F080]/30 hover:bg-[#34F080]/20"
        }`}
      >
        <CircleDollarSign className="w-3.5 h-3.5 text-[#34F080]" />
        <span className="text-[#34F080] font-semibold text-[11px]">
          {usdTotal ?? "..."}
        </span>
        {/* Mini avatar stack */}
        <div className="flex -space-x-1.5">
          {avatarKeys.map((pk) => (
            <div
              key={pk}
              className="rounded-full ring-1 ring-[#141c2b] overflow-hidden"
            >
              <MessagingDisplayAvatar
                publicKey={pk}
                username={getUsernameByPublicKey?.[pk]}
                extraDataPicUrl={profilePicByPublicKey?.[pk]}
                diameter={16}
              />
            </div>
          ))}
        </div>
        {tipperCount > 3 && (
          <span className="text-[#34F080]/60 text-[10px]">
            +{tipperCount - 3}
          </span>
        )}
        <span className="text-[#34F080]/60 text-[10px]">({tipperCount})</span>
      </button>

      {/* Who tipped popup */}
      {showPopup && (() => {
        // Compute aggregation only when popup is open
        const tipsBySender = tips.reduce<Record<string, number>>((acc, t) => {
          acc[t.senderPublicKey] = (acc[t.senderPublicKey] || 0) + t.amountNanos;
          return acc;
        }, {});
        return (
          <div
            ref={popupRef}
            className="absolute bottom-full mb-1 left-0 z-20 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg py-1.5 min-w-[180px] max-h-[200px] overflow-y-auto"
          >
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <CircleDollarSign className="w-3 h-3 text-[#34F080]" />
              Tips
            </div>
            {Object.entries(tipsBySender).map(([pk, nanos]) => {
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
                  <span className="text-[#34F080] text-xs font-semibold ml-auto">
                    {formatDesoAmount(nanos)}
                  </span>
                  {pk === currentUserKey && (
                    <span className="text-[10px] text-[#34F080]">you</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
