import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CircleDollarSign } from "lucide-react";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import { useMobile } from "../../hooks/useMobile";
import {
  fetchExchangeRate,
  nanosToUsd,
  formatUsd,
} from "../../utils/exchange-rate";
import { usdcBaseUnitsToUsd } from "../../utils/usdc-balance";
import { formatDesoAmount } from "../../utils/helpers";
import type { TipCurrency } from "../../utils/extra-data";

let longPressDidFire = false;

interface TipEntry {
  senderPublicKey: string;
  amountNanos: number;
  amountUsdcBaseUnits?: string;
  currency?: TipCurrency;
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

  // Separate DESO and USDC totals
  const desoTotalNanos = tips
    .filter((t) => !t.currency || t.currency === "DESO")
    .reduce((sum, t) => sum + t.amountNanos, 0);
  const usdcTotalBaseUnits = tips
    .filter((t) => t.currency === "USDC" && t.amountUsdcBaseUnits)
    .reduce((sum, t) => sum + BigInt(t.amountUsdcBaseUnits!), 0n);

  const uniqueTippers = useMemo(
    () => [...new Set(tips.map((t) => t.senderPublicKey))],
    [tips]
  );
  const tipperCount = uniqueTippers.length;
  const isOwnTip = tips.some((t) => t.senderPublicKey === currentUserKey);

  // Convert both to USD for a combined total
  useEffect(() => {
    const usdcUsd = usdcBaseUnitsToUsd(usdcTotalBaseUnits);
    if (desoTotalNanos > 0) {
      fetchExchangeRate()
        .then((rate) => {
          const desoUsd = nanosToUsd(desoTotalNanos, rate);
          setUsdTotal(formatUsd(desoUsd + usdcUsd));
        })
        .catch(() => {
          // Show USDC portion only if DESO conversion fails
          if (usdcUsd > 0) setUsdTotal(formatUsd(usdcUsd));
        });
    } else {
      setUsdTotal(formatUsd(usdcUsd));
    }
  }, [desoTotalNanos, usdcTotalBaseUnits]);

  useEffect(() => {
    if (!showPopup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node))
        setShowPopup(false);
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

  const avatarKeys = uniqueTippers.slice(0, 3);
  const hasUsdc = usdcTotalBaseUnits > 0n;

  return (
    <div className="relative">
      <button
        aria-label={`Tips totaling ${usdTotal ?? "..."} from ${tipperCount} ${
          tipperCount === 1 ? "person" : "people"
        }`}
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
        className={`flex items-center gap-1 pl-1.5 pr-2 h-[26px] rounded-full text-xs cursor-pointer transition-colors ${
          isOwnTip
            ? `${
                hasUsdc
                  ? "glass-pill-tip-usdc-active"
                  : "glass-pill-tip-deso-active"
              }`
            : `${
                hasUsdc
                  ? "glass-pill-tip-usdc hover:bg-[#34F080]/[0.08]"
                  : "glass-pill-tip-deso hover:bg-[#2775ca]/[0.08]"
              }`
        }`}
      >
        <span
          className={`font-semibold text-[11px] tabular-nums ${
            hasUsdc ? "text-[#34F080]" : "text-[#2775ca]"
          }`}
        >
          {usdTotal ?? "..."}
        </span>
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
        {tipperCount > 3 && (
          <span
            className={`text-[10px] ${
              hasUsdc ? "text-[#34F080]/60" : "text-[#2775ca]/60"
            }`}
          >
            +{tipperCount - 3}
          </span>
        )}
      </button>

      {showPopup &&
        (() => {
          const tipsBySender = tips.reduce<
            Record<string, { desoNanos: number; usdcBaseUnits: bigint }>
          >((acc, t) => {
            if (!acc[t.senderPublicKey])
              acc[t.senderPublicKey] = { desoNanos: 0, usdcBaseUnits: 0n };
            if (t.currency === "USDC" && t.amountUsdcBaseUnits) {
              acc[t.senderPublicKey]!.usdcBaseUnits += BigInt(
                t.amountUsdcBaseUnits
              );
            } else {
              acc[t.senderPublicKey]!.desoNanos += t.amountNanos;
            }
            return acc;
          }, {});
          return (
            <div
              ref={popupRef}
              className="absolute bottom-full mb-1 left-0 right-auto z-20 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg py-1.5 min-w-[180px] max-w-[calc(100vw-24px)] max-h-[200px] overflow-y-auto"
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <CircleDollarSign
                  className={`w-3 h-3 ${
                    hasUsdc ? "text-[#34F080]" : "text-[#2775ca]"
                  }`}
                />{" "}
                Tips
              </div>
              {Object.entries(tipsBySender).map(([pk, amounts]) => {
                const username = getUsernameByPublicKey?.[pk];
                const parts: string[] = [];
                if (amounts.desoNanos > 0)
                  parts.push(formatDesoAmount(amounts.desoNanos));
                if (amounts.usdcBaseUnits > 0n)
                  parts.push(
                    `${usdcBaseUnitsToUsd(amounts.usdcBaseUnits).toFixed(
                      2
                    )} USDC`
                  );
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
                      disableLink
                    />
                    <span className="text-sm text-gray-200 truncate">
                      {username || `${pk.slice(0, 8)}...`}
                    </span>
                    <span
                      className={`text-xs font-semibold ml-auto ${
                        hasUsdc ? "text-[#34F080]" : "text-[#2775ca]"
                      }`}
                    >
                      {parts.join(" + ")}
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
