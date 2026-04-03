interface ReplyPreviewProps {
  replyPreview: string;
  replySender?: string;
  onClick?: () => void;
}

export const ReplyPreview = ({
  replyPreview,
  replySender,
  onClick,
}: ReplyPreviewProps) => {
  return (
    <div
      className="border-l-2 border-[#34F080] pl-3 pr-3 py-1.5 mb-1 rounded-r-md bg-white/5 text-xs text-gray-400 cursor-pointer hover:bg-white/8 hover:text-gray-200 transition-colors"
      onClick={onClick}
    >
      {replySender && (
        <div className="text-[#34F080] font-semibold mb-0.5">{replySender}</div>
      )}
      <div className="line-clamp-2">{replyPreview}</div>
    </div>
  );
};
