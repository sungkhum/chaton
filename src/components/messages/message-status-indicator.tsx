import { Check, CheckCheck, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { MessageStatus } from "../../store";

interface MessageStatusIndicatorProps {
  status?: MessageStatus;
  onRetry?: () => void;
  onDelete?: () => void;
}

export const MessageStatusIndicator = ({
  status,
  onRetry,
  onDelete,
}: MessageStatusIndicatorProps) => {
  if (!status) return null;

  switch (status) {
    case "processing":
      return <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />;
    case "sending":
      return <Loader2 className="w-3 h-3 text-[#34F080] animate-spin" />;
    case "sent":
      return (
        <span className="status-check-enter inline-flex">
          <Check className="w-3 h-3 text-[#34F080]" />
        </span>
      );
    case "confirmed":
      return (
        <span className="status-confirm-enter inline-flex">
          <CheckCheck className="w-3 h-3 text-[#34F080]" />
        </span>
      );
    case "failed":
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-red-400 hover:text-red-300 cursor-pointer"
            title="Tap to retry"
          >
            <AlertCircle className="w-3 h-3" />
            <span className="text-[10px]">Retry</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-red-400/60 hover:text-red-300 cursor-pointer"
            title="Delete message"
          >
            <Trash2 className="w-3 h-3" />
            <span className="text-[10px]">Delete</span>
          </button>
        </div>
      );
    default:
      return null;
  }
};
