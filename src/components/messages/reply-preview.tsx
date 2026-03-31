interface ReplyPreviewProps {
  replyPreview: string;
  isSender?: boolean;
  onClick?: () => void;
}

export const ReplyPreview = ({ replyPreview, isSender, onClick }: ReplyPreviewProps) => {
  return (
    <div
      className={`flex w-fit border-l-2 border-[#34F080] pl-2 pr-3 py-1 mb-1 rounded-r-md bg-white/5 text-xs text-gray-400 truncate max-w-[250px] cursor-pointer hover:bg-white/8 hover:text-gray-200 transition-colors ${
        isSender ? "ml-auto" : ""
      }`}
      onClick={onClick}
    >
      {replyPreview}
    </div>
  );
};
