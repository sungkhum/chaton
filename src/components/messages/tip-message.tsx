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
import type { TipCurrency } from "../../utils/extra-data";

interface TipMessageProps {
  amountNanos: number;
  amountUsdcBaseUnits?: string;
  currency?: TipCurrency;
  message?: string;
  replyPreview?: string;
  replySender?: string;
  onReplyClick?: () => void;
}

export const TipMessage = ({
  amountNanos,
  amountUsdcBaseUnits,
  currency = "DESO",
  message,
  replyPreview,
  replySender,
  onReplyClick,
}: TipMessageProps) => {
  const [usdAmount, setUsdAmount] = useState<string | null>(null);
  const isUsdc = currency === "USDC";
  // DESO = blue, USDC = green
  const accentColor = isUsdc ? "text-[#34F080]" : "text-[#2775ca]";

  // Parse USDC base units once (BigInt from hex string)
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
