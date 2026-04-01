import { KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Send, Image, Loader2, Pencil, X, Check, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { EmojiPickerButton } from "./compose/emoji-picker-button";
import { GifPicker } from "./compose/gif-picker";
import { ImagePreviewPanel } from "./compose/image-preview-panel";
import { MentionPicker, MentionCandidate } from "./compose/mention-picker";
import { KlipyItem, getMessageUrl, trackShare } from "../services/klipy.service";
import { uploadImage } from "../services/media.service";
import { ReplyBanner } from "./compose/reply-banner";
import { LinkAttachmentPanel } from "./compose/link-attachment-panel";
import { useDraftMessages } from "../hooks/useDraftMessages";
import { buildExtraData, MentionEntry, MSG_MENTIONS } from "../utils/extra-data";
import { useStore } from "../store";
import { OgData } from "../services/og.service";

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
  /** Group chat members for @mention autocomplete. When provided, enables mentions. */
  mentionCandidates?: MentionCandidate[];
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
  mentionCandidates,
}: SendMessageButtonAndInputProps) => {
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; width?: number; height?: number } | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const publicKey = useStore((s) => s.appUser?.PublicKeyBase58Check || "");
  const { getDraft, setDraft, clearDraft } = useDraftMessages(publicKey);

  // Draft persistence
  const [messageToSend, setMessageToSend] = useState(() =>
    conversationKey ? getDraft(conversationKey) : ""
  );

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIdx, setMentionStartIdx] = useState(0);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null || !mentionCandidates) return [];
    return mentionCandidates.filter((c) =>
      c.username.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [mentionQuery, mentionCandidates]);

  // Track confirmed mentions by their username (to encode in ExtraData on send)
  const mentionedUsersRef = useRef<Map<string, MentionCandidate>>(new Map());

  // Reset mention state when conversation changes
  useEffect(() => {
    mentionedUsersRef.current.clear();
    setMentionQuery(null);
  }, [conversationKey]);

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

  /** Collect mentions that are still present in the final message text */
  const collectMentions = useCallback(
    (text: string): MentionEntry[] | undefined => {
      if (mentionedUsersRef.current.size === 0) return undefined;
      const mentions: MentionEntry[] = [];
      for (const [, c] of mentionedUsersRef.current) {
        if (text.includes(`@${c.username}`)) {
          mentions.push({ pk: c.publicKey, un: c.username });
        }
      }
      return mentions.length > 0 ? mentions : undefined;
    },
    []
  );

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
    setMentionQuery(null);
    if (conversationKey) clearDraft(conversationKey);

    // Attach mention metadata if present
    const mentions = collectMentions(msg);
    if (mentions) {
      extraData = { ...extraData, [MSG_MENTIONS]: JSON.stringify(mentions) };
    }
    mentionedUsersRef.current.clear();

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

  const selectMention = useCallback(
    (candidate: MentionCandidate) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Replace from @-trigger position to current cursor with @username + space
      const before = messageToSend.slice(0, mentionStartIdx);
      const after = messageToSend.slice(textarea.selectionStart);
      const insert = `@${candidate.username} `;
      const newValue = before + insert + after;
      setMessageToSend(newValue);
      setMentionQuery(null);

      // Track this mention
      mentionedUsersRef.current.set(candidate.username, candidate);

      requestAnimationFrame(() => {
        const pos = mentionStartIdx + insert.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
        textarea.focus();
      });
    },
    [messageToSend, mentionStartIdx]
  );

  /** Detect whether cursor is inside an @-mention trigger */
  const updateMentionState = useCallback(
    (value: string, cursorPos: number) => {
      if (!mentionCandidates || mentionCandidates.length === 0) {
        setMentionQuery(null);
        return;
      }
      // Walk backwards from cursor to find @
      const textBefore = value.slice(0, cursorPos);
      const atIdx = textBefore.lastIndexOf("@");
      if (atIdx === -1) {
        setMentionQuery(null);
        return;
      }
      // @ must be at start of input or preceded by whitespace
      if (atIdx > 0 && !/\s/.test(textBefore[atIdx - 1])) {
        setMentionQuery(null);
        return;
      }
      const query = textBefore.slice(atIdx + 1);
      // No spaces in mention query
      if (/\s/.test(query)) {
        setMentionQuery(null);
        return;
      }
      setMentionStartIdx(atIdx);
      setMentionQuery(query);
      setMentionSelectedIdx(0);
    },
    [mentionCandidates]
  );

  const handleGifSelect = (item: KlipyItem, caption?: string) => {
    const media = getMessageUrl(item);
    if (!media) return;
    trackShare("gifs", item.slug);
    sendMessage(caption || item.title || "GIF", buildExtraData({
      type: "gif",
      gifUrl: media.url,
      gifTitle: item.title,
      mediaWidth: media.width,
      mediaHeight: media.height,
    }));
  };

  const handleStickerSelect = (item: KlipyItem) => {
    const media = getMessageUrl(item);
    if (!media) return;
    trackShare("stickers", item.slug);
    sendMessage(item.title || "Sticker", buildExtraData({
      type: "sticker",
      gifUrl: media.url,
      gifTitle: item.title,
      mediaWidth: media.width,
      mediaHeight: media.height,
    }));
  };

  // Text that was in the input when an image was staged — used as initial caption
  const [stagedCaption, setStagedCaption] = useState("");

  const stageImage = (file: File) => {
    // Revoke previous preview URL if any
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    // Capture current text as the image caption and clear the main input
    setStagedCaption(messageToSend);
    setMessageToSend("");
    const previewUrl = URL.createObjectURL(file);
    // Read image dimensions from the file for layout reservation
    const img = new window.Image();
    img.onload = () => {
      setPendingImage({ file, previewUrl, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setPendingImage({ file, previewUrl });
    };
    img.src = previewUrl;
    // Set immediately without dimensions; onload will update with dimensions
    setPendingImage({ file, previewUrl });
    setShowLinkPanel(false);
    setShowGifPicker(false);
  };

  const cancelImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    // Restore the text that was in the input before staging
    if (stagedCaption) {
      setMessageToSend(stagedCaption);
      setStagedCaption("");
    }
    setPendingImage(null);
  };

  const confirmImage = async (caption?: string) => {
    if (!pendingImage) return;
    setIsUploading(true);
    try {
      const result = await uploadImage(pendingImage.file);
      await sendMessage(caption || pendingImage.file.name, buildExtraData({
        type: "image",
        imageUrl: result.ImageURL,
        ...(pendingImage.width && pendingImage.height ? { mediaWidth: pendingImage.width, mediaHeight: pendingImage.height } : {}),
      }));
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
      setStagedCaption("");
    } catch (err: any) {
      toast.error(`Image upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    stageImage(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) stageImage(file);
        return;
      }
    }
  };

  const handleLinkSend = (url: string, description?: string, ogData?: OgData) => {
    const body = description ? `📎 ${description}\n${url}` : `📎 ${url}`;
    sendMessage(body, buildExtraData({
      type: "file",
      fileUrl: url,
      fileDescription: description,
      fileName: (() => {
        try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
      })(),
      ogTitle: ogData?.title,
      ogDescription: ogData?.description,
      ogImage: ogData?.image,
    }));
    setShowLinkPanel(false);
  };

  // Auto-size textarea whenever messageToSend changes — covers both typing and
  // programmatic updates (send, cancel edit, conversation switch).
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [messageToSend]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageToSend(value);
    onKeystroke?.();
    updateMentionState(value, e.target.selectionStart);
  };

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : typingUsers.length > 1
        ? `${typingUsers.slice(0, 2).join(", ")} are typing...`
        : null;

  const showMentionPicker = mentionQuery !== null && filteredMentions.length > 0;
  const isExpanded = isFocused || messageToSend.length > 0;

  return (
    <div ref={inputBarRef} className="w-full px-3 pb-3 md:px-6 md:pb-4">
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

      <div className="relative flex flex-wrap md:flex-nowrap items-center gap-x-1 bg-[#0a1019] rounded-2xl border border-white/8 px-2 py-1.5">
        {/* Absolutely-positioned overlays */}
        {showMentionPicker && (
          <MentionPicker
            candidates={filteredMentions}
            query={mentionQuery!}
            selectedIndex={mentionSelectedIdx}
            onSelect={selectMention}
          />
        )}
        {showLinkPanel && (
          <LinkAttachmentPanel
            onSend={handleLinkSend}
            onCancel={() => setShowLinkPanel(false)}
            isSending={isSending}
          />
        )}
        {pendingImage && (
          <ImagePreviewPanel
            file={pendingImage.file}
            previewUrl={pendingImage.previewUrl}
            onSend={confirmImage}
            onCancel={cancelImage}
            isSending={isUploading}
            initialCaption={stagedCaption}
          />
        )}
        {showGifPicker && (
          <GifPicker
            onSelectGif={handleGifSelect}
            onSelectSticker={handleStickerSelect}
            onClose={() => setShowGifPicker(false)}
            customerId={publicKey}
          />
        )}

        {/* Toolbar icons — own row on mobile when input is active, inline on desktop */}
        <div className={`flex items-center gap-1 shrink-0 ${
          isExpanded
            ? "w-full pb-1 mb-0.5 border-b border-white/5 md:w-auto md:pb-0 md:mb-0 md:border-b-0"
            : ""
        }`}>
          <button
            onClick={() => {
              setShowLinkPanel((v) => !v);
              setShowGifPicker(false);
              if (pendingImage) cancelImage();
            }}
            aria-label="Attach a link"
            title="Share a link"
            className="p-2 text-gray-500 hover:text-[#34F080] cursor-pointer shrink-0 transition-colors"
            type="button"
          >
            <Paperclip className="w-[18px] h-[18px]" />
          </button>

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
              onChange={handleImageSelect}
              disabled={isUploading}
            />
          </label>

          <button
            onClick={() => {
              const opening = !showGifPicker;
              setShowGifPicker(opening);
              setShowLinkPanel(false);
              if (pendingImage) cancelImage();
              if (opening) textareaRef.current?.blur();
            }}
            className="px-1.5 py-2 text-gray-500 hover:text-[#34F080] cursor-pointer font-extrabold text-[11px] tracking-wide transition-colors shrink-0"
            type="button"
          >
            GIF
          </button>

          <div className="shrink-0">
            <EmojiPickerButton onEmojiSelect={insertAtCursor} />
          </div>
        </div>

        {/* Auto-growing textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 min-w-0 bg-transparent text-white text-[15px] outline-none resize-none min-h-[36px] max-h-[150px] py-[7px] placeholder:text-gray-600 leading-snug"
          placeholder="Message..."
          value={messageToSend}
          onChange={handleTextareaChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={async (e) => {
            if (e.key === "Escape" && editingMessage) {
              e.preventDefault();
              onCancelEdit?.();
              setMessageToSend(conversationKey ? getDraft(conversationKey) : "");
              return;
            }
            if (showMentionPicker) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionSelectedIdx((i) =>
                  i < filteredMentions.length - 1 ? i + 1 : 0
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionSelectedIdx((i) =>
                  i > 0 ? i - 1 : filteredMentions.length - 1
                );
                return;
              }
              if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const selected = filteredMentions[mentionSelectedIdx];
                if (selected) selectMention(selected);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
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
