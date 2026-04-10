import { Lock } from "lucide-react";

/** Detect raw encrypted hex that slipped through ExtraData decryption */
function looksLikeEncryptedHex(text: string): boolean {
  return text.length >= 64 && /^[0-9a-f]+$/i.test(text);
}

interface ReplyPreviewProps {
  replyPreview: string;
  replySender?: string;
  translatedReplyPreview?: string;
  onClick?: () => void;
}

export const ReplyPreview = ({
  replyPreview,
  replySender,
  translatedReplyPreview,
  onClick,
}: ReplyPreviewProps) => {
  const isEncrypted = looksLikeEncryptedHex(replyPreview);
  const displayText = translatedReplyPreview || replyPreview;

  return (
    <div
      className="border-l-2 border-[#34F080] pl-3 pr-3 py-1.5 mb-1 rounded-r-md bg-white/5 text-xs text-gray-400 cursor-pointer hover:bg-white/8 hover:text-gray-200 transition-colors"
      onClick={onClick}
    >
      {replySender && (
        <div className="text-[#34F080] font-semibold mb-0.5">{replySender}</div>
      )}
      {isEncrypted ? (
        <div className="flex items-center gap-1 text-gray-500 italic">
          <Lock className="w-3 h-3 shrink-0" />
          Encrypted message
        </div>
      ) : (
        <div className="line-clamp-2 break-words">
          {displayText}
          {displayText.length >= 100 && !/[.!?…]$/.test(displayText) && "…"}
        </div>
      )}
    </div>
  );
};
