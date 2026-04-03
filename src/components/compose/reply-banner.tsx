import { X } from "lucide-react";

interface ReplyBannerProps {
  replyTo: string;
  replySender?: string;
  onCancel: () => void;
}

export const ReplyBanner = ({
  replyTo,
  replySender,
  onCancel,
}: ReplyBannerProps) => {
  return (
    <div className="flex items-center justify-between bg-white/5 border-l-2 border-[#34F080] px-3 py-2 mb-2 rounded-r-lg">
      <div className="text-xs truncate flex-1">
        {replySender && (
          <div className="text-[#34F080] font-semibold mb-0.5">
            Replying to {replySender}
          </div>
        )}
        <div className="text-gray-400 truncate">
          <span className="text-gray-200">{replyTo.slice(0, 100)}</span>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="ml-2 text-gray-500 hover:text-white cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
