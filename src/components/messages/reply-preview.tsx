interface ReplyPreviewProps {
  replyPreview: string;
  onClick?: () => void;
}

export const ReplyPreview = ({ replyPreview, onClick }: ReplyPreviewProps) => {
  return (
    <div
      className="border-l-2 border-[#34F080] pl-2 mb-1 text-xs text-gray-400 truncate max-w-[250px] cursor-pointer hover:text-gray-200"
      onClick={onClick}
    >
      {replyPreview}
    </div>
  );
};
