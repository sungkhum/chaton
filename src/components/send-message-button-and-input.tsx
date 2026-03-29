import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Send, Image, Loader2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { EmojiPickerButton } from "./compose/emoji-picker-button";
import { GifPicker } from "./compose/gif-picker";
import { GiphyGif } from "../services/giphy.service";
import { uploadImage } from "../services/media.service";
import { ReplyBanner } from "./compose/reply-banner";
import { useDraftMessages } from "../hooks/useDraftMessages";
import { buildExtraData } from "../utils/extra-data";

export interface SendMessageButtonAndInputProps {
  onClick: (messageToSend: string, extraData?: Record<string, string>) => void;
  replyTo?: { text: string; timestamp: string } | null;
  onCancelReply?: () => void;
  conversationKey?: string;
  onKeystroke?: () => void;
  typingUsers?: string[];
  editingMessage?: { text: string; timestamp: string } | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (newText: string, timestamp: string) => void;
}

export const SendMessageButtonAndInput = ({
  onClick,
  replyTo,
  onCancelReply,
  conversationKey = "",
  onKeystroke,
  typingUsers = [],
  editingMessage,
  onCancelEdit,
  onSubmitEdit,
}: SendMessageButtonAndInputProps) => {
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getDraft, setDraft, clearDraft } = useDraftMessages();

  // Draft persistence
  const [messageToSend, setMessageToSend] = useState(() =>
    conversationKey ? getDraft(conversationKey) : ""
  );

  // Load draft when conversation changes or when exiting edit mode
  useEffect(() => {
    if (conversationKey && !editingMessage) {
      setMessageToSend(getDraft(conversationKey));
    }
  }, [conversationKey, editingMessage]);

  // Pre-fill input when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setMessageToSend(editingMessage.text);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Save draft on change (skip while editing to avoid overwriting)
  useEffect(() => {
    if (conversationKey && !editingMessage) {
      setDraft(conversationKey, messageToSend);
    }
  }, [messageToSend, conversationKey]);

  const sendMessage = async (text?: string, extraData?: Record<string, string>) => {
    // Edit mode: submit the edit instead of sending a new message
    if (editingMessage && onSubmitEdit) {
      const msg = text || messageToSend;
      if (!msg.trim()) {
        toast.warning("Message cannot be empty");
        return;
      }
      onSubmitEdit(msg, editingMessage.timestamp);
      setMessageToSend("");
      if (conversationKey) setDraft(conversationKey, "");
      textareaRef.current?.focus();
      return;
    }

    const msg = text || messageToSend;
    if (!msg && !extraData) {
      toast.warning("The provided message is empty");
      return;
    }
    if (isSending) {
      toast.warning("Going too fast! Please wait a second before sending another message");
      return;
    }
    setIsSending(true);
    setMessageToSend("");
    if (conversationKey) clearDraft(conversationKey);
    try {
      await onClick(msg, extraData);
    } catch (e) {
      setMessageToSend(msg);
    }
    setIsSending(false);
    textareaRef.current?.focus();
  };

  const canSend = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    return e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageToSend((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      messageToSend.slice(0, start) + text + messageToSend.slice(end);
    setMessageToSend(newValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    });
  };

  const handleGifSelect = (gif: GiphyGif) => {
    sendMessage(gif.title || "GIF", buildExtraData({
      type: "gif",
      gifUrl: gif.images.fixed_width.url,
      gifTitle: gif.title,
      mediaWidth: parseInt(gif.images.fixed_width.width),
      mediaHeight: parseInt(gif.images.fixed_width.height),
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      await sendMessage(file.name, buildExtraData({
        type: "image",
        imageUrl: result.ImageURL,
      }));
    } catch (err: any) {
      toast.error(`Image upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fakeEvent = {
            target: { files: [file], value: "" },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleImageUpload(fakeEvent);
        }
        return;
      }
    }
  };

  // Auto-grow textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageToSend(e.target.value);
    onKeystroke?.();
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : typingUsers.length > 1
        ? `${typingUsers.slice(0, 2).join(", ")} are typing...`
        : null;

  return (
    <div className="w-full px-3 pb-3 md:px-6 md:pb-4">
      {typingLabel && (
        <div className="text-xs text-gray-400 px-2 pb-1 animate-pulse">{typingLabel}</div>
      )}

      {replyTo && !editingMessage && (
        <ReplyBanner replyTo={replyTo.text} onCancel={() => onCancelReply?.()} />
      )}

      {editingMessage && (
        <div className="flex items-center justify-between bg-blue-500/10 border-l-2 border-blue-400 px-3 py-2 mb-2 rounded-r-lg">
          <div className="text-xs text-gray-400 truncate flex-1 flex items-center gap-1.5">
            <Pencil className="w-3 h-3 shrink-0" />
            <span>Editing: <span className="text-gray-200">{editingMessage.text.slice(0, 80)}</span></span>
          </div>
          <button
            onClick={() => {
              onCancelEdit?.();
              setMessageToSend(conversationKey ? getDraft(conversationKey) : "");
            }}
            className="ml-2 text-gray-500 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#0a1019] rounded-2xl border border-white/8 px-2 py-1.5">
        {/* Attachment button */}
        <label className={`p-2 text-gray-500 hover:text-[#34F080] cursor-pointer shrink-0 transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
          {isUploading ? (
            <Loader2 className="w-[18px] h-[18px] animate-spin" />
          ) : (
            <Image className="w-[18px] h-[18px]" />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={isUploading}
          />
        </label>

        {/* GIF button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowGifPicker(!showGifPicker)}
            className="px-1.5 py-2 text-gray-500 hover:text-[#34F080] cursor-pointer font-extrabold text-[11px] tracking-wide transition-colors"
            type="button"
          >
            GIF
          </button>
          {showGifPicker && (
            <GifPicker
              onSelect={handleGifSelect}
              onClose={() => setShowGifPicker(false)}
            />
          )}
        </div>

        {/* Emoji button */}
        <div className="shrink-0">
          <EmojiPickerButton onEmojiSelect={insertAtCursor} />
        </div>

        {/* Auto-growing textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent text-white text-[15px] outline-none resize-none min-h-[36px] max-h-[150px] py-[7px] placeholder:text-gray-600 leading-snug"
          placeholder="Message..."
          value={messageToSend}
          onChange={handleTextareaChange}
          onKeyDown={async (e) => {
            if (e.key === "Escape" && editingMessage) {
              e.preventDefault();
              onCancelEdit?.();
              setMessageToSend(conversationKey ? getDraft(conversationKey) : "");
              return;
            }
            if (canSend(e)) {
              e.preventDefault();
              await sendMessage();
            }
          }}
          onPaste={handlePaste}
          rows={1}
        />

        {/* Send / Save button */}
        <button
          onClick={() => sendMessage()}
          disabled={isSending}
          className={`p-2 rounded-full shrink-0 hover:brightness-110 cursor-pointer transition-colors ${
            editingMessage
              ? "bg-gradient-to-r from-blue-400 to-blue-500 text-white"
              : "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black"
          }`}
          type="button"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : editingMessage ? (
            <Check className="w-5 h-5" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      <p className="text-gray-600 text-[10px] mt-1 ml-2 hidden md:block">
        <kbd className="text-gray-500">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
};
