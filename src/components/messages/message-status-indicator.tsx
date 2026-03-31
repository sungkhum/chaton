import { CheckCheck, AlertCircle, Loader2 } from "lucide-react";
import { MessageStatus } from "../../store";

interface MessageStatusIndicatorProps {
  status?: MessageStatus;
  onRetry?: () => void;
}

export const MessageStatusIndicator = ({
  status,
  onRetry,
}: MessageStatusIndicatorProps) => {
  if (!status) return null;

  switch (status) {
    case "sending":
      return <Loader2 className="w-3 h-3 text-[#34F080] animate-spin" />;
    case "sent":
      return <Loader2 className="w-3 h-3 text-[#34F080] animate-spin" />;
    case "confirmed":
      return <CheckCheck className="w-3 h-3 text-[#34F080]" />;
    case "failed":
      return (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-red-400 hover:text-red-300 cursor-pointer"
          title="Tap to retry"
        >
          <AlertCircle className="w-3 h-3" />
          <span className="text-[10px]">Retry</span>
        </button>
      );
    default:
      return null;
  }
};
