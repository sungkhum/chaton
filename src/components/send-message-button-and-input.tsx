import { KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition, ViewTransition } from "react";
import { Send, Image, Loader2, Pencil, X, Check, Paperclip, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { EmojiPickerButton } from "./compose/emoji-picker-button";
import { GifPicker } from "./compose/gif-picker";
import { ImagePreviewPanel } from "./compose/image-preview-panel";
import { VideoPreviewPanel } from "./compose/video-preview-panel";
import { MentionPicker, MentionCandidate } from "./compose/mention-picker";
import { KlipyItem, getMessageUrl, getDisplayUrl, trackShare } from "../services/klipy.service";
import { uploadImage, uploadVideoFile } from "../services/media.service";
import { ReplyBanner } from "./compose/reply-banner";
import { LinkAttachmentPanel, LinkAttachmentPanelHandle } from "./compose/link-attachment-panel";
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
  /** Called when the user taps the $ tip button in the toolbar. */
  onTipClick?: () => void;
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
  onTipClick,
}: SendMessageButtonAndInputProps) => {
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; width?: number; height?: number } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<{ file: File; previewUrl: string; width?: number; height?: number; duration?: number; thumbnail?: string } | null>(null);
  const [pendingGif, setPendingGif] = useState<KlipyItem | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const linkPanelRef = useRef<LinkAttachmentPanelHandle>(null);
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

  // Auto-focus input when replying to a message
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

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

  const stageGif = (item: KlipyItem) => {
    setPendingGif(item);
    setShowGifPicker(false);
    setShowLinkPanel(false);
    if (pendingImage) { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }
    if (pendingVideo) { URL.revokeObjectURL(pendingVideo.previewUrl); setPendingVideo(null); }
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelGif = () => {
    setPendingGif(null);
  };

  const confirmGif = (caption?: string) => {
    if (!pendingGif) return;
    const media = getMessageUrl(pendingGif);
    if (!media) return;
    trackShare("gifs", pendingGif.slug);
    sendMessage(caption || pendingGif.title || "GIF", buildExtraData({
      type: "gif",
      gifUrl: media.url,
      gifTitle: pendingGif.title,
      mediaWidth: media.width,
      mediaHeight: media.height,
    }));
    setPendingGif(null);
  };

  const stageImage = (file: File) => {
    // Revoke previous preview URL if any
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
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
    setPendingImage(null);
  };

  const confirmImage = async (caption?: string) => {
    if (!pendingImage) return;
    setIsUploading(true);
    try {
      const result = await uploadImage(pendingImage.file);
      // Use DeSo app format (encryptedImageURLs + image.0.*) for cross-app compatibility
      const extraData: Record<string, string> = {
        encryptedImageURLs: JSON.stringify([result.ImageURL]), // JSON array — DeSo app format
      };
      if (pendingImage.width) extraData["image.0.width"] = String(pendingImage.width);
      if (pendingImage.height) extraData["image.0.height"] = String(pendingImage.height);
      if (pendingImage.width && pendingImage.height) {
        extraData["image.0.orientation"] = pendingImage.width >= pendingImage.height ? "landscape" : "portrait";
      }
      await sendMessage(caption || "", extraData);
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
    } catch (err: any) {
      toast.error(`Image upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const stageVideo = (file: File) => {
    if (pendingVideo) URL.revokeObjectURL(pendingVideo.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setPendingVideo((prev) => prev ? { ...prev, width: video.videoWidth, height: video.videoHeight, duration: video.duration } : prev);
      // Capture a thumbnail frame from the local video
      video.currentTime = 0.1;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
          setPendingVideo((prev) => prev ? { ...prev, thumbnail } : prev);
        }
      } catch { /* cross-origin or other canvas error — skip thumbnail */ }
    };
    video.onerror = () => {
      setPendingVideo({ file, previewUrl });
    };
    video.src = previewUrl;
    setPendingVideo({ file, previewUrl });
    setShowLinkPanel(false);
    setShowGifPicker(false);
  };

  const cancelVideo = () => {
    if (pendingVideo) URL.revokeObjectURL(pendingVideo.previewUrl);
    setPendingVideo(null);
  };

  const confirmVideo = async (caption?: string) => {
    if (!pendingVideo) return;
    setIsUploading(true);
    try {
      const result = await uploadVideoFile(pendingVideo.file);
      // Use DeSo app format (encryptedVideoURLs + video.0.*) for cross-app compatibility
      const extraData: Record<string, string> = {
        encryptedVideoURLs: JSON.stringify([result.url]), // JSON array — DeSo app format
      };
      if (pendingVideo.width) extraData["video.0.width"] = String(pendingVideo.width);
      if (pendingVideo.height) extraData["video.0.height"] = String(pendingVideo.height);
      if (pendingVideo.width && pendingVideo.height) {
        extraData["video.0.orientation"] = pendingVideo.width >= pendingVideo.height ? "landscape" : "portrait";
      }
      // Local-only thumbnail for optimistic display — stripped before blockchain submission
      if (pendingVideo.thumbnail) extraData["_localThumbnail"] = pendingVideo.thumbnail;
      await sendMessage(caption || "", extraData);
      URL.revokeObjectURL(pendingVideo.previewUrl);
      setPendingVideo(null);
    } catch (err: any) {
      toast.error(`Video upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.type.startsWith("video/")) {
      stageVideo(file);
    } else {
      stageImage(file);
    }
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
      if (item.type.startsWith("video/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) stageVideo(file);
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

  /** Unified send: routes to link/image/video/gif confirm when media is staged, otherwise normal send */
  const handleSend = async () => {
    if (showLinkPanel && linkPanelRef.current) {
      await linkPanelRef.current.triggerSend();
      return;
    }
    if (pendingGif) {
      confirmGif(messageToSend || undefined);
      setMessageToSend("");
      if (conversationKey) setDraft(conversationKey, "");
      return;
    }
    if (pendingImage) {
      await confirmImage(messageToSend || undefined);
      return;
    }
    if (pendingVideo) {
      await confirmVideo(messageToSend || undefined);
      return;
    }
    await sendMessage();
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
    <div ref={inputBarRef} className="w-full px-3 pb-3 pt-2 md:px-6 md:pb-4 md:pt-3 border-t border-white/[0.06] bg-white/[0.02]">
      {typingLabel && (
        <div className="text-xs text-gray-400 px-2 pb-1 animate-pulse">{typingLabel}</div>
      )}

      {replyTo && !editingMessage && (
        <ViewTransition enter="slide-up" exit="fade-out" default="none">
        <ReplyBanner replyTo={replyTo.text} onCancel={() => onCancelReply?.()} />
        </ViewTransition>
      )}

      {editingMessage && (
        <ViewTransition enter="slide-up" exit="fade-out" default="none">
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
        </ViewTransition>
      )}

      <div className={`relative flex flex-col glass-compose rounded-2xl px-3 py-2 transition-[border-color,box-shadow] duration-200 ${isExpanded ? "border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : ""}`}>
        {/* Absolutely-positioned overlays */}
        {showMentionPicker && (
          <MentionPicker
            candidates={filteredMentions}
            query={mentionQuery!}
            selectedIndex={mentionSelectedIdx}
            onSelect={selectMention}
          />
        )}
        {showGifPicker && (
          <ViewTransition enter="fade-in" exit="fade-out" default="none">
          <GifPicker
            onSelectGif={handleGifSelect}
            onStageGif={stageGif}
            onSelectSticker={handleStickerSelect}
            onClose={() => startTransition(() => setShowGifPicker(false))}
            customerId={publicKey}
          />
          </ViewTransition>
        )}

        {/* Inline attachments — inside the compose box */}
        {showLinkPanel && (
          <ViewTransition enter="fade-in" exit="fade-out" default="none">
          <LinkAttachmentPanel
            ref={linkPanelRef}
            onSend={handleLinkSend}
            onCancel={() => startTransition(() => setShowLinkPanel(false))}
            isSending={isSending}
          />
          </ViewTransition>
        )}
        {pendingGif && (() => {
          const preview = getDisplayUrl(pendingGif, "md");
          return (
            <div className="w-full pb-2 mb-1 border-b border-white/[0.06]">
              <div className="relative inline-block">
                {preview && (
                  <img
                    src={preview.url}
                    alt={pendingGif.title}
                    className="max-h-[160px] w-auto rounded-lg object-contain"
                  />
                )}
                <button
                  onClick={cancelGif}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 border border-white/20 text-gray-300 hover:text-white hover:bg-black/90 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">{pendingGif.title || "GIF"}</p>
            </div>
          );
        })()}
        {pendingImage && (
          <ViewTransition enter="fade-in" exit="fade-out" default="none">
          <ImagePreviewPanel
            file={pendingImage.file}
            previewUrl={pendingImage.previewUrl}
            onCancel={cancelImage}
          />
          </ViewTransition>
        )}
        {pendingVideo && (
          <ViewTransition enter="fade-in" exit="fade-out" default="none">
          <VideoPreviewPanel
            file={pendingVideo.file}
            previewUrl={pendingVideo.previewUrl}
            onCancel={cancelVideo}
          />
          </ViewTransition>
        )}

        {/* Input row — icons, textarea, send all inline */}
        <div className="flex items-center gap-x-1">
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => startTransition(() => {
                setShowLinkPanel((v) => !v);
                setShowGifPicker(false);
                if (pendingImage) cancelImage();
                if (pendingVideo) cancelVideo();
              })}
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
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelect}
                disabled={isUploading}
              />
            </label>

            <button
              onClick={() => {
                const opening = !showGifPicker;
                startTransition(() => {
                  setShowGifPicker(opening);
                  setShowLinkPanel(false);
                  if (pendingImage) cancelImage();
                  if (pendingVideo) cancelVideo();
                });
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

            {onTipClick && (
              <button
                onClick={() => {
                  setShowGifPicker(false);
                  setShowLinkPanel(false);
                  onTipClick();
                }}
                aria-label="Send a tip"
                title="Send a tip"
                className="p-2 text-gray-500 hover:text-white cursor-pointer shrink-0 transition-colors"
                type="button"
              >
                <CircleDollarSign className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>

          <textarea
            ref={textareaRef}
            className="flex-1 min-w-0 bg-transparent text-white text-[15px] outline-none resize-none min-h-[36px] max-h-[150px] py-[7px] placeholder:text-gray-500 leading-snug"
            placeholder="Type a message..."
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
                await handleSend();
              }
            }}
            onPaste={handlePaste}
            rows={1}
          />

          {/* Send / Save button */}
          <button
            onClick={() => handleSend()}
            disabled={isSending || isUploading}
            className={`p-2 rounded-full shrink-0 cursor-pointer transition-all ${
              editingMessage
                ? "glass-send-edit text-blue-300 hover:border-blue-400/60"
                : "glass-fab text-[#34F080] hover:border-[#34F080]/60"
            }`}
            type="button"
          >
            {isSending || isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : editingMessage ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-[10px] mt-1 ml-2 hidden md:block">
        <kbd className="text-gray-500">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
};
