import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { formatDesoAmount } from "../../utils/helpers";
import {
  fetchExchangeRate,
  nanosToUsd,
  formatUsd,
} from "../../utils/exchange-rate";
import { usdcBaseUnitsToUsd } from "../../utils/usdc-balance";
import { ReplyPreview } from "./reply-preview";
import { FormattedMessage } from "./formatted-message";
import { MessagingDisplayAvatar } from "../messaging-display-avatar";
import type { TipCurrency } from "../../utils/extra-data";

/** Shared hook for converting tip amount to USD display string */
function useTipUsd(
  amountNanos: number,
  amountUsdcBaseUnits: string | undefined,
  currency: TipCurrency
) {
  const [usdAmount, setUsdAmount] = useState<string | null>(null);
  const isUsdc = currency === "USDC";
  const usdcUsd =
    isUsdc && amountUsdcBaseUnits
      ? usdcBaseUnitsToUsd(BigInt(amountUsdcBaseUnits))
      : null;

  useEffect(() => {
    if (usdcUsd != null) {
      setUsdAmount(formatUsd(usdcUsd));
    } else if (!isUsdc && amountNanos > 0) {
      fetchExchangeRate()
        .then((rate) => {
          setUsdAmount(formatUsd(nanosToUsd(amountNanos, rate)));
        })
        .catch(() => {});
    }
  }, [amountNanos, usdcUsd, isUsdc]);

  const subLabel =
    usdcUsd != null
      ? `${usdcUsd.toFixed(2)} USDC`
      : formatDesoAmount(amountNanos);

  return { usdAmount, subLabel, isUsdc };
}

interface TipMessageProps {
  amountNanos: number;
  amountUsdcBaseUnits?: string;
  currency?: TipCurrency;
  message?: string;
  replyPreview?: string;
  replySender?: string;
  onReplyClick?: () => void;
}

/** Full receipt-style tip display (used when there's no custom message) */
export const TipMessage = ({
  amountNanos,
  amountUsdcBaseUnits,
  currency = "DESO",
  message,
  replyPreview,
  replySender,
  onReplyClick,
}: TipMessageProps) => {
  const { usdAmount, subLabel, isUsdc } = useTipUsd(
    amountNanos,
    amountUsdcBaseUnits,
    currency
  );
  const accentColor = isUsdc ? "text-[#34F080]" : "text-[#2775ca]";

  return (
    <div className="select-text">
      {replyPreview && (
        <ReplyPreview
          replyPreview={replyPreview}
          replySender={replySender}
          onClick={onReplyClick}
        />
      )}
      <div className="flex items-center gap-1.5 mb-0.5">
        <CircleDollarSign className={`w-4 h-4 ${accentColor} shrink-0`} />
        <span className={`${accentColor} font-bold text-base`}>
          {usdAmount ?? "..."}
        </span>
      </div>
      <div className="text-gray-400 text-[10px] mb-0.5">{subLabel}</div>
      {message && (
        <div className="mt-1">
          <FormattedMessage>{message}</FormattedMessage>
        </div>
      )}
    </div>
  );
};

interface TipFooterProps {
  amountNanos: number;
  amountUsdcBaseUnits?: string;
  currency?: TipCurrency;
  recipientUsername?: string;
  recipientPicUrl?: string;
  recipientPublicKey?: string;
}

/** Glowing glassmorphism tip badge shown below custom message text */
export const TipFooter = ({
  amountNanos,
  amountUsdcBaseUnits,
  currency = "DESO",
  recipientUsername,
  recipientPicUrl,
  recipientPublicKey,
}: TipFooterProps) => {
  const { usdAmount, isUsdc } = useTipUsd(
    amountNanos,
    amountUsdcBaseUnits,
    currency
  );
  const glassClass = isUsdc ? "glass-tip-badge-usdc" : "glass-tip-badge-deso";
  const textColor = isUsdc ? "text-[#34F080]" : "text-[#2775ca]";
  const glowColor = isUsdc ? "#34F080" : "#2775ca";
  const recipient = recipientUsername || recipientPublicKey?.slice(0, 8);

  return (
    <div
      className={`flex items-center gap-2 mt-2.5 px-2.5 py-1.5 rounded-lg ${glassClass}`}
    >
      <CircleDollarSign className={`w-4 h-4 shrink-0 ${textColor}`} />
      <span
        className={`text-xs font-bold ${textColor}`}
        style={{ textShadow: `0 0 8px ${glowColor}40` }}
      >
        Tipped {usdAmount ?? "..."}
      </span>
      {recipient && (
        <>
          <span className="text-white/25 text-xs">to</span>
          {recipientPublicKey && (
            <MessagingDisplayAvatar
              publicKey={recipientPublicKey}
              username={recipientUsername}
              extraDataPicUrl={recipientPicUrl}
              diameter={16}
              disableLink
            />
          )}
          <span className="text-xs text-gray-200 font-medium truncate">
            {recipientUsername ? `@${recipientUsername}` : `${recipient}...`}
          </span>
        </>
      )}
    </div>
  );
};
