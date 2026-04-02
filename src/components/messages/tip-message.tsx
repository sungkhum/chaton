import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { formatDesoAmount } from "../../utils/helpers";
import { fetchExchangeRate, nanosToUsd, formatUsd } from "../../utils/exchange-rate";
import { ReplyPreview } from "./reply-preview";
import { FormattedMessage } from "./formatted-message";

interface TipMessageProps {
  amountNanos: number;
  message?: string;
  replyPreview?: string;
  isSender?: boolean;
  onReplyClick?: () => void;
}

export const TipMessage = ({
  amountNanos,
  message,
  replyPreview,
  isSender,
  onReplyClick,
}: TipMessageProps) => {
  const [usdAmount, setUsdAmount] = useState<string | null>(null);

  useEffect(() => {
    fetchExchangeRate().then((rate) => {
      setUsdAmount(formatUsd(nanosToUsd(amountNanos, rate)));
    }).catch(() => {
      // Fallback: show DESO only (usdAmount stays null)
    });
  }, [amountNanos]);

  return (
    <div className="select-text">
      {replyPreview && (
        <ReplyPreview
          replyPreview={replyPreview}
          isSender={isSender}
          onClick={onReplyClick}
        />
      )}
      <div className="flex items-center gap-1.5 mb-0.5">
        <CircleDollarSign className="w-4 h-4 text-[#34F080] shrink-0" />
        <span className="text-[#34F080] font-bold text-base">
          {usdAmount ?? "..."}
        </span>
      </div>
      <div className="text-gray-500 text-[10px] mb-0.5">
        {formatDesoAmount(amountNanos)}
      </div>
      {message && (
        <div className="mt-1">
          <FormattedMessage>{message}</FormattedMessage>
        </div>
      )}
    </div>
  );
};
