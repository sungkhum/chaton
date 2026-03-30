import { X, Send, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface ImagePreviewPanelProps {
  file: File;
  previewUrl: string;
  onSend: (caption?: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

export const ImagePreviewPanel = ({
  file,
  previewUrl,
  onSend,
  onCancel,
  isSending,
}: ImagePreviewPanelProps) => {
  const [caption, setCaption] = useState("");
  const captionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    captionRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (isSending) return;
    const trimmed = caption.trim();
    onSend(trimmed || undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 w-[320px] md:w-[400px] bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-blue-800/30">
        <span className="text-sm text-blue-100 font-medium flex-1 truncate">
          {file.name}
        </span>
        <button
          onClick={onCancel}
          className="cursor-pointer text-blue-400/60 hover:text-blue-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image preview */}
      <div className="flex items-center justify-center p-4 max-h-[260px] overflow-hidden">
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-[230px] w-auto rounded-lg object-contain"
        />
      </div>

      {/* Caption input + send */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-blue-800/30">
        <input
          ref={captionRef}
          type="text"
          placeholder="Add a message..."
          className="flex-1 bg-[#0a1019] text-white text-sm outline-none placeholder:text-gray-600 rounded-lg px-3 py-2 border border-white/8"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending}
          className="p-2 rounded-full bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:brightness-110 cursor-pointer transition-colors shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
