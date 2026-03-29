import { X } from "lucide-react";

interface ReplyBannerProps {
  replyTo: string;
  onCancel: () => void;
}

export const ReplyBanner = ({ replyTo, onCancel }: ReplyBannerProps) => {
  return (
    <div className="flex items-center justify-between bg-white/5 border-l-2 border-[#34F080] px-3 py-2 mb-2 rounded-r-lg">
      <div className="text-xs text-gray-400 truncate flex-1">
        Replying to: <span className="text-gray-200">{replyTo.slice(0, 100)}</span>
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
