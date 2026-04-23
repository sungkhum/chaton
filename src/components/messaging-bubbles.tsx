import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  GetPaginatedMessagesForDmThreadResponse,
  GetPaginatedMessagesForGroupChatThreadResponse,
} from "deso-protocol";
import {
  ArrowDown,
  Loader2,
  Lock,
  Reply,
  Plus,
  Pencil,
  Trash2,
  CircleDollarSign,
  Copy,
  Ban,
  Heart,
  MessageSquare,
  Languages,
  Pin,
  PinOff,
} from "lucide-react";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChunkErrorBoundary } from "./shared/chunk-error-boundary";

// bundle-conditional: frimousse only loads when user opens the full emoji search
const LazyReactionEmojiPicker = lazy(() =>
  import("./messages/reaction-emoji-picker").then((m) => ({
    default: m.ReactionEmojiPicker,
  }))
);
import { toast } from "sonner";
import { useMobile } from "../hooks/useMobile";
import { decryptAccessGroupMessagesWithRetry } from "../services/conversations.service";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MESSAGES_ONE_REQUEST_LIMIT,
} from "../utils/constants";
import { parseMessageType, tipHasCustomMessage } from "../utils/extra-data";
import {
  getCachedTipCurrency,
  getCachedPreferredLanguage,
  getCachedAutoTranslate,
  getCachedLastReadTimestamps,
} from "../services/cache.service";
import { useTranslation } from "../hooks/useTranslation";
import { getLanguageName } from "./language-selector";
import { Conversation, ConversationMap } from "../utils/types";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessageStatusIndicator } from "./messages/message-status-indicator";
import { ImageMessage } from "./messages/image-message";
import { GifMessage } from "./messages/gif-message";
import { StickerMessage } from "./messages/sticker-message";
import { VideoMessage } from "./messages/video-message";
import { AudioMessage } from "./messages/audio-message";
import { FileMessage } from "./messages/file-message";
import { ReplyPreview } from "./messages/reply-preview";
import { ReactionPills } from "./messages/reaction-pills";
import { TipMessage, TipFooter } from "./messages/tip-message";
import { TipPills } from "./messages/tip-pills";
import { FormattedMessage } from "./messages/formatted-message";
import { LinkPreview, extractFirstUrl } from "./messages/link-preview";
import {
  AnimatedEmoji,
  parseEmojiOnlyMessage,
} from "./messages/animated-emoji";
import { shortenLongWord } from "../utils/search-helpers";

// rerender-memo-with-default-value: hoisted constants avoid new refs each render
const NO_CALLOUT_STYLE = {
  WebkitTouchCallout: "none",
  touchAction: "pan-y",
} as React.CSSProperties & { WebkitTouchCallout: string };
const EMPTY_STRINGS: string[] = [];

export interface MessagingBubblesProps {
  conversations: ConversationMap;
  conversationPublicKey: string;
  getUsernameByPublicKey: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
  /** Timestamp (nanos) of the last message the user had read when they opened
   *  this conversation. Used to render the "New messages" divider and auto-scroll. */
  lastReadTimestampNanos?: number | null;
  onScroll: (e: Array<DecryptedMessageEntryResponse>) => void;
  onReply?: (message: DecryptedMessageEntryResponse) => void;
  onReact?: (
    timestampNanosString: string,
    emoji: string,
    forceAction?: "add" | "remove"
  ) => void;
  onRetry?: (localId: string) => void;
  onDeleteFailed?: (localId: string) => void;
  onEdit?: (message: DecryptedMessageEntryResponse) => void;
  onDeleteForMe?: (timestampNanosString: string) => void;
  onDeleteForEveryone?: (message: DecryptedMessageEntryResponse) => void;
  onTip?: (message: DecryptedMessageEntryResponse, amountUsd?: number) => void;
  onMicroTip?: (message: DecryptedMessageEntryResponse) => void;
  onPrivateMessage?: (senderPublicKey: string) => void;
  onPin?: (timestampNanosString: string, preview?: string) => void;
  pinnedMessageTimestamp?: string;
  pendingTipTimestamps?: Set<string>;
  hiddenMessageIds?: Set<string>;
  onScrollToReply?: (ts: string) => void;
  onReloadLatest?: () => boolean;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const GROUP_TIME_GAP_NS = 5 * 60 * 1e9; // 5 minutes in nanoseconds

function convertTstampToDateTime(tstampNanos: number) {
  const date = new Date(tstampNanos / 1e6);
  const currentDate = new Date();
  if (date.getFullYear() !== currentDate.getFullYear()) {
    const yearsAgo = currentDate.getFullYear() - date.getFullYear();
    return yearsAgo === 1 ? "a year ago" : `${yearsAgo} years ago`;
  }
  if (
    date.getDate() !== currentDate.getDate() ||
    date.getMonth() !== currentDate.getMonth()
  ) {
    return date.toLocaleString("default", { month: "short", day: "numeric" });
  }
  return date.toLocaleString("default", { hour: "numeric", minute: "numeric" });
}

/** Detect raw encrypted hex that slipped through decryption without throwing */
function looksLikeEncryptedHex(text: string): boolean {
  return text.length >= 64 && /^[0-9a-f]+$/i.test(text);
}

function MessageContent({
  message,
  tipRecipientUsername,
  tipRecipientPicUrl,
  translatedText,
  translatedSourceLang,
  showingOriginal,
  onToggleOriginal,
}: {
  message: DecryptedMessageEntryResponse;
  tipRecipientUsername?: string;
  tipRecipientPicUrl?: string;
  translatedText?: string;
  translatedSourceLang?: string;
  showingOriginal?: boolean;
  onToggleOriginal?: () => void;
}) {
  const parsed = parseMessageType(message);

  if (parsed.deleted) {
    const time = convertTstampToDateTime(message.MessageInfo.TimestampNanos);
    return (
      <span className="text-white/30 italic text-[13px] select-text inline-flex items-center gap-1.5 py-0.5 px-1">
        <Ban className="w-3 h-3 shrink-0 opacity-40" />
        This message was deleted
        <span className="text-[10px] not-italic text-white/20 ml-1">
          {time}
        </span>
      </span>
    );
  }

  if (
    (message.error && !message.DecryptedMessage) ||
    looksLikeEncryptedHex(message.DecryptedMessage)
  ) {
    return (
      <span className="text-gray-500 italic text-sm select-text flex items-center gap-1.5">
        <Lock className="w-3 h-3 shrink-0" />
        Unable to decrypt this message
      </span>
    );
  }

  const messageToShow = message.DecryptedMessage || message.error || "";

  switch (parsed.type) {
    case "image": {
      // Show caption below image if the message text looks like a user-written caption
      // (i.e. not just the original filename)
      const imageCaption =
        messageToShow && !/\.\w{2,5}$/.test(messageToShow.trim())
          ? messageToShow
          : undefined;
      return parsed.imageUrl ? (
        <ImageMessage
          imageUrl={parsed.imageUrl}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
          caption={
            imageCaption ? (
              <FormattedMessage mentions={parsed.mentions} className="text-sm">
                {imageCaption}
              </FormattedMessage>
            ) : undefined
          }
        />
      ) : (
        <FormattedMessage mentions={parsed.mentions}>
          {messageToShow}
        </FormattedMessage>
      );
    }

    case "gif": {
      // Show caption below GIF if the message text differs from the gif title
      const gifCaption =
        messageToShow &&
        messageToShow !== parsed.gifTitle &&
        messageToShow !== "GIF"
          ? messageToShow
          : undefined;
      return parsed.gifUrl ? (
        <GifMessage
          gifUrl={parsed.gifUrl}
          title={parsed.gifTitle}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
          caption={
            gifCaption ? (
              <FormattedMessage mentions={parsed.mentions} className="text-sm">
                {gifCaption}
              </FormattedMessage>
            ) : undefined
          }
        />
      ) : (
        <FormattedMessage mentions={parsed.mentions}>
          {messageToShow}
        </FormattedMessage>
      );
    }

    case "sticker":
      return parsed.gifUrl ? (
        <StickerMessage
          stickerUrl={parsed.gifUrl}
          title={parsed.gifTitle}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
        />
      ) : (
        <FormattedMessage mentions={parsed.mentions}>
          {messageToShow}
        </FormattedMessage>
      );

    case "video": {
      const videoCaption =
        messageToShow && messageToShow !== "video" ? messageToShow : undefined;
      return parsed.videoUrl ? (
        <div>
          <VideoMessage
            videoUrl={parsed.videoUrl}
            width={parsed.mediaWidth}
            height={parsed.mediaHeight}
            duration={parsed.duration}
            localThumbnail={parsed.localThumbnail}
          />
          {videoCaption && (
            <div className="mt-1.5 px-3 pb-1 select-text">
              <FormattedMessage mentions={parsed.mentions} className="text-sm">
                {videoCaption}
              </FormattedMessage>
            </div>
          )}
        </div>
      ) : (
        <FormattedMessage mentions={parsed.mentions}>
          {messageToShow}
        </FormattedMessage>
      );
    }

    case "audio":
      return (
        <AudioMessage
          audioUrl={parsed.audioUrl}
          duration={parsed.duration}
          waveformSeed={message.MessageInfo.TimestampNanosString}
        />
      );

    case "file":
      return (
        <FileMessage
          fileUrl={parsed.fileUrl || parsed.imageUrl || ""}
          fileName={parsed.fileName || "File"}
          fileSize={parsed.fileSize}
          fileType={parsed.fileType}
          description={parsed.fileDescription}
          ogTitle={parsed.ogTitle}
          ogDescription={parsed.ogDescription}
          ogImage={parsed.ogImage}
        />
      );

    case "tip": {
      // Custom message tips render message-first with a compact tip footer.
      // Explicit flag from ExtraData; fallback to regex for old messages.
      if (tipHasCustomMessage(parsed)) {
        return (
          <div className="select-text">
            <FormattedMessage mentions={parsed.mentions}>
              {messageToShow}
            </FormattedMessage>
            <TipFooter
              amountNanos={parsed.tipAmountNanos || 0}
              amountUsdcBaseUnits={parsed.tipAmountUsdcBaseUnits}
              currency={parsed.tipCurrency}
              recipientUsername={tipRecipientUsername}
              recipientPicUrl={tipRecipientPicUrl}
              recipientPublicKey={parsed.tipRecipient}
            />
          </div>
        );
      }
      return (
        <TipMessage
          amountNanos={parsed.tipAmountNanos || 0}
          amountUsdcBaseUnits={parsed.tipAmountUsdcBaseUnits}
          currency={parsed.tipCurrency}
          message={messageToShow}
          mentions={parsed.mentions}
          replyPreview={parsed.replyPreview}
          replySender={parsed.replySender}
        />
      );
    }

    case "reaction":
      // Reactions are aggregated, not shown as standalone messages
      return null;

    case "system":
      // System messages are rendered inline by the parent (SystemLogMessage)
      return null;

    case "text":
    default: {
      const emojiOnly = messageToShow
        ? parseEmojiOnlyMessage(messageToShow)
        : null;
      if (emojiOnly) {
        const emojiSize =
          emojiOnly.length === 1 ? 64 : emojiOnly.length === 2 ? 48 : 36;
        return (
          <span className="flex gap-1.5 items-center">
            {emojiOnly.map((e, i) => (
              <AnimatedEmoji key={i} emoji={e} size={emojiSize} />
            ))}
          </span>
        );
      }
      const displayText =
        translatedText && !showingOriginal ? translatedText : messageToShow;
      const firstUrl = extractFirstUrl(messageToShow);
      return (
        <>
          <FormattedMessage mentions={parsed.mentions}>
            {displayText}
          </FormattedMessage>
          {translatedText && onToggleOriginal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleOriginal();
              }}
              className="block text-[10px] text-white/30 mt-0.5 italic cursor-pointer hover:text-white/50 transition-colors"
            >
              {showingOriginal
                ? "🌐 See translation"
                : `🌐 Translated from ${getLanguageName(
                    translatedSourceLang || ""
                  )}`}
            </button>
          )}
          {firstUrl && <LinkPreview url={firstUrl} />}
        </>
      );
    }
  }
}

export interface MessagingBubblesHandle {
  scrollToMessage: (ts: string) => boolean;
}

export const MessagingBubblesAndAvatar = React.forwardRef<
  MessagingBubblesHandle,
  MessagingBubblesProps
>(
  (
    {
      conversations,
      conversationPublicKey,
      getUsernameByPublicKey,
      profilePicByPublicKey,
      lastReadTimestampNanos,
      onScroll,
      onReply,
      onReact,
      onRetry,
      onDeleteFailed,
      onEdit,
      onDeleteForMe,
      onDeleteForEveryone,
      onTip,
      onMicroTip,
      onPrivateMessage,
      onPin,
      pinnedMessageTimestamp,
      pendingTipTimestamps,
      hiddenMessageIds,
      onScrollToReply,
      onReloadLatest,
    },
    ref
  ) => {
    const messageAreaRef = useRef<HTMLDivElement>(null);

    const { appUser, allAccessGroups, setAllAccessGroups, openUserActionMenu } =
      useStore(
        useShallow((s) => ({
          appUser: s.appUser,
          allAccessGroups: s.allAccessGroups,
          setAllAccessGroups: s.setAllAccessGroups,
          openUserActionMenu: s.openUserActionMenu,
        }))
      );

    const handleUserActionClick = useCallback(
      (publicKey: string, username: string | undefined) =>
        (e: React.MouseEvent<HTMLElement>) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          openUserActionMenu(
            publicKey,
            {
              top: rect.top,
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom,
            },
            username || undefined
          );
        },
      [openUserActionMenu]
    );
    const conversation =
      conversations[conversationPublicKey] ??
      ({
        messages: [],
        ChatType: ChatType.DM,
        firstMessagePublicKey: "",
      } as Conversation);

    const [allowScrolling, setAllowScrolling] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
    const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(
      null
    );
    const [mobileActionFor, setMobileActionFor] = useState<string | null>(null);
    const [showTipTooltip, setShowTipTooltip] = useState(() => {
      try {
        return !localStorage.getItem("hasSeenTipTooltip");
      } catch {
        return false;
      }
    });
    // --- Unread divider & jump-to-latest ---
    const unreadDividerRef = useRef<HTMLDivElement>(null);
    const hasScrolledToUnreadRef = useRef(false);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);

    // --- Translation ---
    // js-cache-storage: read localStorage once via lazy useState, not on every render
    const [preferredLang] = useState(() =>
      appUser
        ? getCachedPreferredLanguage(appUser.PublicKeyBase58Check) ||
          navigator.language?.split("-")[0] ||
          "en"
        : "en"
    );
    const [autoTranslateEnabled] = useState(() =>
      appUser ? getCachedAutoTranslate(appUser.PublicKeyBase58Check) : false
    );
    const { translations, translatingKeys, translateMessage } = useTranslation(
      conversation.messages,
      appUser?.PublicKeyBase58Check,
      preferredLang,
      autoTranslateEnabled
    );
    const [showingOriginalKeys, setShowingOriginalKeys] = useState<Set<string>>(
      new Set()
    );
    const toggleOriginal = useCallback((key: string) => {
      setShowingOriginalKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }, []);

    // Micro-tip button color based on user's preferred currency (DESO=blue, USDC=green)
    const tipCurrencyPref = appUser
      ? getCachedTipCurrency(appUser.PublicKeyBase58Check)
      : null;
    const microTipIsDeso = !tipCurrencyPref || tipCurrencyPref === "DESO";
    const microTipColor = microTipIsDeso ? "#2775ca" : "#34F080";
    const microTipTextColor = microTipIsDeso
      ? "text-[#2775ca]"
      : "text-[#34F080]";

    // Auto-dismiss tip tooltip after 4 seconds
    useEffect(() => {
      if (!showTipTooltip) return;
      const timer = setTimeout(() => {
        setShowTipTooltip(false);
        try {
          localStorage.setItem("hasSeenTipTooltip", "1");
        } catch {
          /* ignore storage errors */
        }
      }, 4000);
      return () => clearTimeout(timer);
    }, [showTipTooltip]);
    const [deleteMenuFor, setDeleteMenuFor] = useState<string | null>(null);
    const [actionBarFlipped, setActionBarFlipped] = useState(false);
    const actionBarRef = useRef<HTMLDivElement>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const activeBubbleRef = useRef<HTMLElement | null>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
    const suppressSelectionRef = useRef(false);
    const suppressResizeDismissRef = useRef(false);
    const reactionPickerForRef = useRef(reactionPickerFor);
    reactionPickerForRef.current = reactionPickerFor;
    const { isMobile, isTouchDevice } = useMobile();

    // iOS ignores user-select:none during long-press — actively clear any
    // text selection the OS creates while a long-press gesture is in progress.
    // Also catches late/delayed selection events after the gesture ends by
    // checking if the selection falls inside a .mobile-no-select element.
    useEffect(() => {
      if (!isTouchDevice) return;
      const onSelectionChange = () => {
        if (suppressSelectionRef.current) {
          // Don't nuke selection when user is typing in an input — that
          // disconnects iOS WebKit's keyboard from the focused element.
          if (
            document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement
          )
            return;
          window.getSelection()?.removeAllRanges();
          return;
        }
        // Catch late iOS selections inside message bubbles even after
        // suppressionRef is released (e.g. after menu dismissal)
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const node = sel.getRangeAt(0).commonAncestorContainer;
        const el =
          node.nodeType === 1
            ? (node as Element)
            : (node as Node).parentElement;
        if (el?.closest?.(".mobile-no-select")) {
          sel.removeAllRanges();
        }
      };
      document.addEventListener("selectionchange", onSelectionChange);
      return () =>
        document.removeEventListener("selectionchange", onSelectionChange);
    }, [isTouchDevice]);

    // Position desktop emoji picker (portaled to body) near the reaction bar
    useLayoutEffect(() => {
      const el = pickerRef.current;
      const bubble = activeBubbleRef.current;
      if (!el || !bubble || isTouchDevice) return;

      const bubbleRect = bubble.getBoundingClientRect();
      const bar = actionBarRef.current;
      const barRect = bar?.getBoundingClientRect();
      const scrollArea = messageAreaRef.current;
      const scrollRect = scrollArea?.getBoundingClientRect();
      const topBound = scrollRect ? scrollRect.top : 0;
      const bottomBound = scrollRect ? scrollRect.bottom : window.innerHeight;
      const elHeight = el.offsetHeight;
      const elWidth = el.offsetWidth;

      // Use the reaction bar position if available, otherwise fall back to bubble
      const anchorTop = barRect ? barRect.top : bubbleRect.top;
      const anchorBottom = barRect ? barRect.bottom : bubbleRect.bottom;

      // Vertical: prefer above the anchor; fall back to below
      const spaceAbove = anchorTop - topBound;
      if (spaceAbove >= elHeight + 8) {
        el.style.top = `${anchorTop - elHeight - 8}px`;
        el.style.bottom = "auto";
      } else {
        let top = anchorBottom + 8;
        top = Math.min(top, bottomBound - elHeight);
        el.style.top = `${Math.max(topBound, top)}px`;
        el.style.bottom = "auto";
      }

      // Horizontal: align with bubble edge, clamped to viewport
      const isSender =
        bubbleRect.left + bubbleRect.width / 2 > window.innerWidth / 2;
      let left = isSender ? bubbleRect.right - elWidth : bubbleRect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - elWidth - 8));
      el.style.left = `${left}px`;
    }, [reactionPickerFor, isTouchDevice]);

    // Close reaction picker / delete menu / desktop action bar on click outside
    useEffect(() => {
      if (!reactionPickerFor && !deleteMenuFor && !hoveredMessage) return;
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (pickerRef.current && !pickerRef.current.contains(target)) {
          setReactionPickerFor(null);
        }
        // Don't dismiss action bar when clicking inside it or its sub-menus
        if (actionBarRef.current && actionBarRef.current.contains(target))
          return;
        if (actionMenuRef.current && actionMenuRef.current.contains(target))
          return;
        if (pickerRef.current && pickerRef.current.contains(target)) return;
        setDeleteMenuFor(null);
        setHoveredMessage(null);
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [reactionPickerFor, deleteMenuFor, hoveredMessage]);

    // Close mobile action bar on scroll or viewport resize (keyboard open/close)
    useEffect(() => {
      if (!mobileActionFor || !messageAreaRef.current) return;
      const scrollArea = messageAreaRef.current;
      const dismiss = () => {
        suppressSelectionRef.current = false;
        setMobileActionFor(null);
        setReactionPickerFor(null);
      };
      const onScroll = () => {
        if (!reactionPickerForRef.current) dismiss();
      };
      scrollArea.addEventListener("scroll", onScroll, { passive: true });
      // iOS: keyboard open/close changes visualViewport but not scroll events
      const vv = window.visualViewport;
      const onResize = () => {
        if (!suppressResizeDismissRef.current && !reactionPickerForRef.current)
          dismiss();
      };
      if (vv) vv.addEventListener("resize", onResize);
      return () => {
        scrollArea.removeEventListener("scroll", onScroll);
        if (vv) vv.removeEventListener("resize", onResize);
      };
    }, [mobileActionFor]);

    // Reposition mobile emoji bottom sheet above iOS virtual keyboard.
    // On iOS, `position:fixed; bottom:0` anchors to the layout viewport (behind
    // the keyboard), not the visual viewport. Use the visualViewport API to
    // compute the keyboard height and shift the sheet up so it sits above it.
    useLayoutEffect(() => {
      if (!isTouchDevice || !reactionPickerFor) return;
      const el = pickerRef.current;
      const vv = window.visualViewport;
      if (!el || !vv) return;

      const reposition = () => {
        const keyboardOffset = Math.max(
          0,
          window.innerHeight - vv.height - vv.offsetTop
        );
        el.style.bottom = `${keyboardOffset}px`;

        // If picker + keyboard would overflow the screen, shrink the picker
        const available = vv.height - 56; // 56px buffer for top header bar
        if (available < 360) {
          el.style.maxHeight = `${Math.max(180, available)}px`;
          el.style.overflow = "hidden";
        } else {
          el.style.maxHeight = "";
          el.style.overflow = "";
        }
      };

      reposition();
      vv.addEventListener("resize", reposition);
      vv.addEventListener("scroll", reposition);
      return () => {
        vv.removeEventListener("resize", reposition);
        vv.removeEventListener("scroll", reposition);
        el.style.bottom = "0px";
        el.style.maxHeight = "";
        el.style.overflow = "";
      };
    }, [isTouchDevice, reactionPickerFor]);

    const clearLongPressTimer = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        // Only stop suppression if no menu is open (timer cancelled by scroll/move)
        suppressSelectionRef.current = false;
      }
      longPressPosRef.current = null;
    }, []);

    // Determine if the action bar should render below the bubble instead of above.
    // Uses ~200px as estimated action bar height (reactions row + menu).
    const computeFlip = useCallback((bubbleEl: HTMLElement | null) => {
      if (!bubbleEl || !messageAreaRef.current) {
        setActionBarFlipped(false);
        return;
      }
      const bubbleRect = bubbleEl.getBoundingClientRect();
      const scrollRect = messageAreaRef.current.getBoundingClientRect();
      const spaceAbove = bubbleRect.top - scrollRect.top;
      setActionBarFlipped(spaceAbove < 200);
    }, []);

    // Position reaction bar and action menu as a coordinated pair so they never overlap.
    // Preferred layout: reactions above bubble, menu below.
    // If one side runs out of space, both stack on the side that has room.
    useLayoutEffect(() => {
      const bubble = activeBubbleRef.current;
      if (!bubble) return;
      if (isTouchDevice && !mobileActionFor) return;
      if (!isTouchDevice && !hoveredMessage) return;

      const bubbleRect = bubble.getBoundingClientRect();
      if (bubbleRect.width === 0 && bubbleRect.height === 0) return;

      const scrollArea = messageAreaRef.current;
      const scrollRect = scrollArea?.getBoundingClientRect();
      const pad = 12;
      const vv = window.visualViewport;
      const vvTop = vv ? vv.offsetTop : 0;
      const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const minTop = Math.max(scrollRect ? scrollRect.top : 0, vvTop);
      const maxBottom = Math.min(
        scrollRect ? scrollRect.bottom : window.innerHeight,
        vvBottom
      );
      const isSenderMsg =
        bubbleRect.left + bubbleRect.width / 2 > window.innerWidth / 2;

      // Helper: position a portal element horizontally aligned with the bubble
      const positionHorizontally = (el: HTMLElement) => {
        const elWidth = el.offsetWidth;
        let left = isSenderMsg ? bubbleRect.right - elWidth : bubbleRect.left;
        left = Math.max(pad, Math.min(left, window.innerWidth - elWidth - pad));
        el.style.left = `${left}px`;
      };

      const bar = actionBarRef.current;
      const menu = actionMenuRef.current;
      const gap = 4;

      const barHeight = bar?.offsetHeight ?? 0;
      const menuHeight = menu?.offsetHeight ?? 0;

      const spaceAbove = bubbleRect.top - minTop;
      const spaceBelow = maxBottom - bubbleRect.bottom;

      // Visible portion of the bubble within the scroll area
      const visibleTop = Math.max(bubbleRect.top, minTop);
      const visibleBottom = Math.min(bubbleRect.bottom, maxBottom);
      const visibleBubbleHeight = Math.max(0, visibleBottom - visibleTop);

      // For tall bubbles (images, long text), splitting bar above and menu below
      // creates a huge gap. Stack them together as a single unit instead.
      const maxSplitDistance = 250;
      const isTallBubble = visibleBubbleHeight > maxSplitDistance;

      const barFitsAbove = spaceAbove >= barHeight + gap;
      const menuFitsBelow = spaceBelow >= menuHeight + gap;
      const bothFitAbove = spaceAbove >= barHeight + menuHeight + gap * 3;
      const bothFitBelow = spaceBelow >= barHeight + menuHeight + gap * 3;

      let barTop: number | undefined;
      let menuTop: number | undefined;

      if (isTallBubble) {
        // Tall bubble: stack bar + menu together at the visible center
        const totalHeight = barHeight + gap + menuHeight;
        const visibleMid = (visibleTop + visibleBottom) / 2;
        let stackTop = visibleMid - totalHeight / 2;
        stackTop = Math.max(
          minTop + pad,
          Math.min(stackTop, maxBottom - totalHeight - pad)
        );
        if (bar) barTop = stackTop;
        if (menu) menuTop = stackTop + barHeight + gap;
      } else if (barFitsAbove && menuFitsBelow) {
        // Normal split: reactions above bubble, menu below bubble
        if (bar) barTop = bubbleRect.top - barHeight - gap;
        if (menu) menuTop = bubbleRect.bottom + gap;
      } else if (bothFitAbove) {
        // Stack both above: reactions adjacent to bubble, menu above reactions
        if (bar) barTop = bubbleRect.top - barHeight - gap;
        if (menu) menuTop = bubbleRect.top - barHeight - gap * 2 - menuHeight;
      } else if (bothFitBelow) {
        // Stack both below: reactions adjacent to bubble, menu below reactions
        if (bar) barTop = bubbleRect.bottom + gap;
        if (menu) menuTop = bubbleRect.bottom + gap + barHeight + gap;
      } else {
        // Tight space — place each on their best side, clamped to viewport
        if (bar) barTop = bubbleRect.top - barHeight - gap;
        if (menu) menuTop = bubbleRect.bottom + gap;
      }

      // Position bar first, then ensure the menu is always below the bar.
      // Previous approach clamped each independently, which let the menu
      // get pushed above the bar when it was very tall.
      if (bar && barTop !== undefined) {
        barTop = Math.max(minTop, Math.min(barTop, maxBottom - barHeight));
        bar.style.top = `${barTop}px`;
        bar.style.bottom = "auto";
        positionHorizontally(bar);
      }

      if (menu && menuTop !== undefined) {
        // Menu must never overlap the bar — enforce minimum top.
        const minMenuTop =
          bar && barTop !== undefined ? barTop + barHeight + gap : minTop;
        menuTop = Math.max(minMenuTop, menuTop);

        // Clamp so the menu doesn't extend past the scroll area bottom
        // (but never push it above the bar).
        menuTop = Math.max(
          minMenuTop,
          Math.min(menuTop, maxBottom - menuHeight - pad)
        );

        menu.style.top = `${menuTop}px`;
        menu.style.bottom = "auto";

        // If the menu is taller than the remaining space, make it scrollable.
        const availableHeight = maxBottom - menuTop - pad;
        if (menuHeight > availableHeight && availableHeight > 100) {
          menu.style.maxHeight = `${availableHeight}px`;
          menu.style.overflowY = "auto";
        } else {
          menu.style.maxHeight = "";
          menu.style.overflowY = "";
        }
        positionHorizontally(menu);
      }
    }, [mobileActionFor, hoveredMessage, isTouchDevice, actionBarFlipped]);

    // Clean up timer on unmount
    useEffect(() => {
      return () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      };
    }, []);

    // Clear action state and reset scroll on conversation switch
    useEffect(() => {
      suppressSelectionRef.current = false;
      setMobileActionFor(null);
      setReactionPickerFor(null);
      setDeleteMenuFor(null);
      setAllowScrolling(true);
      clearLongPressTimer();
    }, [conversationPublicKey, clearLongPressTimer]);

    const handleTouchStart = useCallback(
      (e: React.TouchEvent, messageKey: string) => {
        // Clear any existing timer (e.g. multi-touch)
        clearLongPressTimer();
        const touch = e.touches[0]!;
        longPressPosRef.current = { x: touch.clientX, y: touch.clientY };
        // Start suppressing iOS text selection immediately on touch
        suppressSelectionRef.current = true;
        // Capture currentTarget synchronously — React nullifies it after the handler returns
        const target = e.currentTarget as HTMLElement;
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          // Dismiss keyboard so the menu positions within the visible viewport
          if (document.activeElement instanceof HTMLElement) {
            suppressResizeDismissRef.current = true;
            document.activeElement.blur();
            requestAnimationFrame(() => {
              suppressResizeDismissRef.current = false;
            });
          }
          // Clear any iOS text selection that started during the hold
          window.getSelection()?.removeAllRanges();
          // Keep suppressSelectionRef = true while the menu is open. iOS fires
          // its own native long-press ~200ms after our 300ms timer, creating a
          // selection inside the portaled menu (e.g. "Reply") and showing the
          // system Copy/Look Up callout. The selectionchange handler's input-
          // focus guard keeps emoji-search typing working; closeMobileAction
          // resets this to false when the menu dismisses.
          if (navigator.vibrate) navigator.vibrate(20);
          setReactionPickerFor(null); // Close picker from previous message
          const bubble = target.querySelector<HTMLElement>(
            ".relative.inline-block"
          );
          computeFlip(bubble);
          activeBubbleRef.current = bubble;
          setMobileActionFor(messageKey);
        }, 300);
      },
      [clearLongPressTimer, computeFlip]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!longPressPosRef.current) return;
        const touch = e.touches[0]!;
        const dx = touch.clientX - longPressPosRef.current.x;
        const dy = touch.clientY - longPressPosRef.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearLongPressTimer();
        }
      },
      [clearLongPressTimer]
    );

    const handleTouchEnd = useCallback(() => {
      // If timer was still running (short tap), delay-release suppression so
      // late iOS selectionchange events that fire just after finger-lift are caught.
      if (longPressTimerRef.current) {
        setTimeout(() => {
          suppressSelectionRef.current = false;
        }, 100);
      }
      clearLongPressTimer();
    }, [clearLongPressTimer]);

    const closeMobileAction = useCallback(() => {
      clearLongPressTimer(); // Kill pending timer so bar doesn't reopen
      suppressSelectionRef.current = false;
      setMobileActionFor(null);
      activeBubbleRef.current = null;
      setHoveredMessage(null);
      setReactionPickerFor(null);
      setDeleteMenuFor(null);
    }, [clearLongPressTimer]);

    const sentinelRef = useRef<HTMLDivElement>(null);

    // Use conversation messages directly — no intermediate state copy.
    // This eliminates the stale-render frame caused by syncing via useEffect.
    const visibleMessages = conversation.messages;

    // Aggregate reactions from reaction-type messages.
    // Deduplicated: one reaction per user per emoji per message (last-write-wins).
    // Properly handles action:"remove" — if a user's latest action is "remove",
    // they are excluded from that emoji's reactor list.
    const reactionsByTimestamp = useMemo(() => {
      // First pass: collect the latest action per (targetTimestamp, emoji, sender)
      const latest: Record<
        string,
        Record<string, Record<string, { action: "add" | "remove"; ts: number }>>
      > = {};
      for (const msg of visibleMessages) {
        const parsed = parseMessageType(msg);
        if (parsed.type === "reaction" && parsed.replyTo && parsed.emoji) {
          const target = parsed.replyTo;
          const emoji = parsed.emoji;
          const sender = msg.SenderInfo.OwnerPublicKeyBase58Check;
          const ts = msg.MessageInfo.TimestampNanos;
          const action = parsed.action || "add";

          if (!latest[target]) latest[target] = {};
          if (!latest[target][emoji]) latest[target][emoji] = {};

          const existing = latest[target][emoji][sender];
          if (!existing || ts > existing.ts) {
            latest[target][emoji][sender] = { action, ts };
          }
        }
      }

      // Second pass: build the final map with only active "add" reactions
      const map: Record<string, Record<string, string[]>> = {};
      for (const [target, emojiMap] of Object.entries(latest)) {
        for (const [emoji, senderMap] of Object.entries(emojiMap)) {
          for (const [sender, { action }] of Object.entries(senderMap)) {
            if (action === "remove") continue;
            if (!map[target]) map[target] = {};
            if (!map[target][emoji]) map[target][emoji] = [];
            map[target][emoji].push(sender);
          }
        }
      }
      return map;
    }, [visibleMessages]);

    // Aggregate tips from tip-type messages (for tip pills on tipped messages)
    const tipsByTimestamp = useMemo(() => {
      const map: Record<
        string,
        Array<{
          senderPublicKey: string;
          amountNanos: number;
          amountUsdcBaseUnits?: string;
          currency?: "DESO" | "USDC";
        }>
      > = {};
      for (const msg of visibleMessages) {
        const parsed = parseMessageType(msg);
        if (
          parsed.type === "tip" &&
          parsed.tipReplyTo &&
          (parsed.tipAmountNanos || parsed.tipAmountUsdcBaseUnits)
        ) {
          if (!map[parsed.tipReplyTo]) map[parsed.tipReplyTo] = [];
          map[parsed.tipReplyTo]!.push({
            senderPublicKey: msg.SenderInfo.OwnerPublicKeyBase58Check,
            amountNanos: parsed.tipAmountNanos || 0,
            amountUsdcBaseUnits: parsed.tipAmountUsdcBaseUnits,
            currency: parsed.tipCurrency,
          });
        }
      }
      return map;
    }, [visibleMessages]);

    // Track the previous newest message to detect new arrivals
    const prevNewestRef = useRef<string | null>(null);

    useEffect(() => {
      if (visibleMessages.length === 0) {
        setAllowScrolling(false);
        prevNewestRef.current = null;
        return;
      }

      const newestKey = visibleMessages[0]!.MessageInfo.TimestampNanosString;
      const hadPrevious = prevNewestRef.current !== null;
      const isNewArrival = hadPrevious && newestKey !== prevNewestRef.current;
      prevNewestRef.current = newestKey;

      if (!isNewArrival) return;

      // Don't auto-scroll for hidden message types (reactions, tip pills) —
      // they don't appear in the message list so scrolling is disruptive.
      const newestParsed = parseMessageType(visibleMessages[0]!);
      if (newestParsed.type === "reaction") return;
      if (
        newestParsed.type === "tip" &&
        newestParsed.tipReplyTo &&
        !tipHasCustomMessage(newestParsed)
      )
        return;

      const isLastMessageFromMe = visibleMessages[0]!.IsSender;
      const scrollableArea = messageAreaRef.current;
      if (!scrollableArea || !isLastMessageFromMe) return;

      // Scroll immediately on next frame — no 500ms delay
      requestAnimationFrame(() => {
        const scrollerStub = scrollableArea.querySelector(".scroller-end-stub");
        scrollerStub?.scrollIntoView({ behavior: "smooth" });
      });
    }, [visibleMessages]);

    // Auto-scroll to the unread divider on first render with messages
    useEffect(() => {
      if (hasScrolledToUnreadRef.current) return;
      if (!unreadDividerRef.current || !messageAreaRef.current) return;
      hasScrolledToUnreadRef.current = true;
      // Use requestAnimationFrame so the DOM has laid out the divider
      requestAnimationFrame(() => {
        unreadDividerRef.current?.scrollIntoView({ block: "center" });
      });
    }, [visibleMessages.length]); // re-check when messages arrive (including from cache)

    // rerender-use-ref-transient-values: track scroll position in ref, only
    // setState when the boolean actually flips to avoid re-renders during momentum scroll.
    const showJumpRef = useRef(false);
    useEffect(() => {
      const el = messageAreaRef.current;
      if (!el) return;
      const handleScroll = () => {
        // scrollTop is <= 0 in a flex-col-reverse container
        const shouldShow = el.scrollTop < -300;
        if (shouldShow !== showJumpRef.current) {
          showJumpRef.current = shouldShow;
          setShowJumpToLatest(shouldShow);
        }
      };
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToLatest = useCallback(() => {
      const didReload = onReloadLatest?.();
      if (didReload) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = messageAreaRef.current;
            if (!el) return;
            const stub = el.querySelector(".scroller-end-stub");
            stub?.scrollIntoView({ behavior: "smooth" });
          });
        });
        return;
      }
      const el = messageAreaRef.current;
      if (!el) return;
      const stub = el.querySelector(".scroller-end-stub");
      stub?.scrollIntoView({ behavior: "smooth" });
    }, [onReloadLatest]);

    const loadMore = useCallback(async () => {
      if (!appUser || isLoadingMore) return;
      if (visibleMessages.length < MESSAGES_ONE_REQUEST_LIMIT) {
        setAllowScrolling(false);
        return;
      }

      setIsLoadingMore(true);

      try {
        const StartTimeStampString =
          visibleMessages[visibleMessages.length - 1]!.MessageInfo
            .TimestampNanosString;

        const dmOrGroupChatMessages = await (conversation.ChatType ===
        ChatType.DM
          ? getPaginatedDMThread({
              UserGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
              UserGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
              PartyGroupOwnerPublicKeyBase58Check: (visibleMessages[0]!.IsSender
                ? visibleMessages[0]!.RecipientInfo
                : visibleMessages[0]!.SenderInfo
              ).OwnerPublicKeyBase58Check,
              PartyGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
              StartTimeStampString,
              MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
            })
          : getPaginatedGroupChatThread({
              UserPublicKeyBase58Check:
                visibleMessages[visibleMessages.length - 1]!.RecipientInfo
                  .OwnerPublicKeyBase58Check,
              AccessGroupKeyName:
                visibleMessages[visibleMessages.length - 1]!.RecipientInfo
                  .AccessGroupKeyName,
              StartTimeStampString,
              MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
            }));

        const messages =
          conversation.ChatType === ChatType.DM
            ? (dmOrGroupChatMessages as GetPaginatedMessagesForDmThreadResponse)
                .ThreadMessages
            : (
                dmOrGroupChatMessages as GetPaginatedMessagesForGroupChatThreadResponse
              ).GroupChatMessages;

        const publicKeyToProfileEntryResponseMap =
          dmOrGroupChatMessages.PublicKeyToProfileEntryResponse;
        Object.entries(publicKeyToProfileEntryResponseMap).forEach(
          ([publicKey, profileEntryResponse]) => {
            getUsernameByPublicKey[publicKey] =
              profileEntryResponse?.Username || "";
          }
        );

        if (messages.length < MESSAGES_ONE_REQUEST_LIMIT)
          setAllowScrolling(false);
        if (messages.length === 0) return;

        const { decrypted, updatedAllAccessGroups } =
          await decryptAccessGroupMessagesWithRetry(
            appUser.PublicKeyBase58Check,
            messages,
            allAccessGroups
          );
        setAllAccessGroups(updatedAllAccessGroups);
        onScroll(decrypted);
      } catch (e) {
        toast.error("Failed to load more messages");
        console.error(e);
      } finally {
        setIsLoadingMore(false);
      }
    }, [
      appUser,
      visibleMessages,
      conversation,
      allAccessGroups,
      isLoadingMore,
    ]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
      if (!sentinelRef.current || !allowScrolling) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]!.isIntersecting) loadMore();
        },
        { root: messageAreaRef.current, threshold: 0.1 }
      );
      observer.observe(sentinelRef.current);
      return () => observer.disconnect();
    }, [allowScrolling, loadMore]);

    if (
      Object.keys(conversations).length === 0 ||
      conversationPublicKey === ""
    ) {
      return null;
    }

    // Filter out reaction messages (aggregated), hidden messages (delete for me),
    // and small tip messages (≤$5) that are attached to another message (shown on pill instead)
    const displayMessages = useMemo(() => {
      return visibleMessages.filter((msg) => {
        const parsed = parseMessageType(msg);
        if (parsed.type === "reaction") return false;
        if (hiddenMessageIds?.has(msg.MessageInfo.TimestampNanosString))
          return false;
        // Hide tips attached to a parent message unless they have a custom message.
        // Tips without custom messages show only as tip pills on the parent.
        if (parsed.type === "tip" && parsed.tipReplyTo) {
          if (!tipHasCustomMessage(parsed)) return false;
        }
        return true;
      });
    }, [visibleMessages, hiddenMessageIds]);

    // js-combine-iterations: find divider index and count unreads in a single pass.
    // Messages are sorted newest-first (index 0 = newest). The divider goes right
    // before the first message whose timestamp <= lastReadTimestampNanos.
    const { unreadDividerIndex, unreadCount } = useMemo(() => {
      if (lastReadTimestampNanos == null || displayMessages.length === 0)
        return { unreadDividerIndex: -1, unreadCount: 0 };
      // Sending a message implies the user has read everything up to that
      // point. Advance the effective last-read to the user's latest sent
      // message so the divider doesn't persist above messages they've
      // clearly seen and responded to.
      let effectiveLastRead = lastReadTimestampNanos;
      for (const msg of displayMessages) {
        if (msg.MessageInfo.TimestampNanos <= lastReadTimestampNanos) break;
        if (msg.IsSender) {
          // newest-first — first IsSender hit is the latest sent message
          effectiveLastRead = msg.MessageInfo.TimestampNanos;
          break;
        }
      }
      let dividerIdx = -1;
      let count = 0;
      for (let i = 0; i < displayMessages.length; i++) {
        const msg = displayMessages[i]!;
        const ts = msg.MessageInfo.TimestampNanos;
        if (ts <= effectiveLastRead) {
          dividerIdx = i;
          break;
        }
        if (!msg.IsSender) {
          const msgType = msg.MessageInfo?.ExtraData?.["msg:type"];
          if (msgType !== "system" && msgType !== "reaction") count++;
        }
      }
      // No messages at or below the last-read timestamp → all are unread
      if (dividerIdx === -1 && count > 0) {
        dividerIdx = displayMessages.length;
      }
      // No unread messages from others
      if (count === 0) return { unreadDividerIndex: -1, unreadCount: 0 };
      // Skip past sender's own messages at the top of the unread block so the
      // divider never appears immediately above a message the user sent.
      while (dividerIdx > 0 && displayMessages[dividerIdx - 1]!.IsSender) {
        dividerIdx--;
      }
      return { unreadDividerIndex: dividerIdx, unreadCount: count };
    }, [displayMessages, lastReadTimestampNanos]);

    // --- Unread mentions & reactions (Telegram-style indicators) ---
    // Tracks timestamps the user has already viewed by clicking the floating buttons
    const [dismissedMentions, setDismissedMentions] = useState<Set<string>>(
      () => new Set()
    );
    const [dismissedReactions, setDismissedReactions] = useState<Set<string>>(
      () => new Set()
    );

    // The `lastReadTimestampNanos` prop is frozen at conversation-open time so
    // the "New messages" divider stays stable. But for reaction/mention indicators,
    // we need the *current* cached lastRead — which is updated whenever the user
    // is actively viewing and new messages arrive (via polling/WS). Without this,
    // dismissed reactions reappear after app restart because the frozen prop is
    // older than the cached value.
    const myPublicKey = appUser?.PublicKeyBase58Check;

    // Read the cached lastRead once on mount and re-read only when the message
    // count changes (a lightweight proxy for poll/WS updates that also call
    // cacheLastReadTimestamp). Avoids hitting localStorage + JSON.parse on every
    // render. (js-cache-storage)
    const messageCount = visibleMessages.length;
    const cachedLastRead = useMemo(() => {
      if (!myPublicKey || !conversationPublicKey) return undefined;
      const timestamps = getCachedLastReadTimestamps(myPublicKey);
      return timestamps[conversationPublicKey];
    }, [myPublicKey, conversationPublicKey, messageCount]);

    // Use the greater of the frozen open-time value and the cached value.
    // The frozen value ensures we still show reactions that arrived before the
    // user opened; the cached value handles reopens where the user already
    // advanced past them in a previous session.
    const reactionCutoffNanos =
      cachedLastRead !== undefined && lastReadTimestampNanos != null
        ? Math.max(cachedLastRead, lastReadTimestampNanos)
        : lastReadTimestampNanos;

    // Messages from others that @mention the current user (unread only)
    const unreadMentionTimestamps = useMemo(() => {
      if (!reactionCutoffNanos || !myPublicKey) return EMPTY_STRINGS;
      const result: string[] = [];
      for (const msg of displayMessages) {
        if (msg.IsSender) continue;
        if (msg.MessageInfo.TimestampNanos <= reactionCutoffNanos) break; // sorted newest-first
        const parsed = parseMessageType(msg);
        if (
          parsed.mentions &&
          parsed.mentions.some((m) => m.pk === myPublicKey)
        ) {
          if (!dismissedMentions.has(msg.MessageInfo.TimestampNanosString)) {
            result.push(msg.MessageInfo.TimestampNanosString);
          }
        }
      }
      return result.length > 0 ? result : EMPTY_STRINGS;
    }, [displayMessages, reactionCutoffNanos, myPublicKey, dismissedMentions]);

    // Unread reactions to the current user's messages — returns timestamps of
    // the *target* messages (the user's messages that were reacted to)
    const unreadReactionTargets = useMemo(() => {
      if (!reactionCutoffNanos || !myPublicKey) return EMPTY_STRINGS;
      // Build a set of the current user's message timestamps for quick lookup
      const myTimestamps = new Set<string>();
      for (const msg of visibleMessages) {
        if (msg.IsSender) {
          myTimestamps.add(msg.MessageInfo.TimestampNanosString);
        }
      }
      const targets = new Set<string>();
      for (const msg of visibleMessages) {
        if (msg.IsSender) continue;
        if (msg.MessageInfo.TimestampNanos <= reactionCutoffNanos) break; // sorted newest-first
        const parsed = parseMessageType(msg);
        if (
          parsed.type === "reaction" &&
          parsed.replyTo &&
          parsed.action !== "remove" &&
          myTimestamps.has(parsed.replyTo)
        ) {
          if (!dismissedReactions.has(parsed.replyTo)) {
            targets.add(parsed.replyTo);
          }
        }
      }
      if (targets.size === 0) return EMPTY_STRINGS;
      return Array.from(targets);
    }, [visibleMessages, reactionCutoffNanos, myPublicKey, dismissedReactions]);

    // Cycling index for scroll-to-mention / scroll-to-reaction buttons
    const mentionIdxRef = useRef(0);
    const reactionIdxRef = useRef(0);

    // Reset cycling indices when the lists change
    useEffect(() => {
      mentionIdxRef.current = 0;
    }, [unreadMentionTimestamps]);
    useEffect(() => {
      reactionIdxRef.current = 0;
    }, [unreadReactionTargets]);

    const scrollToMessage = useCallback((ts: string): boolean => {
      const wrapper = messageAreaRef.current?.querySelector<HTMLElement>(
        `[data-ts="${ts}"]`
      );
      if (wrapper) {
        wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
        // Highlight the bubble itself so the flash follows the rounded corners
        const bubble = wrapper.querySelector<HTMLElement>(
          ".relative.inline-block > div"
        );
        const target = bubble ?? wrapper;
        target.classList.add("highlight-flash");
        setTimeout(() => target.classList.remove("highlight-flash"), 1800);
        return true;
      }
      return false;
    }, []);

    React.useImperativeHandle(ref, () => ({ scrollToMessage }), [
      scrollToMessage,
    ]);

    const scrollToNextMention = useCallback(() => {
      if (unreadMentionTimestamps.length === 0) return;
      const idx = mentionIdxRef.current % unreadMentionTimestamps.length;
      const ts = unreadMentionTimestamps[idx]!;
      scrollToMessage(ts);
      setDismissedMentions((prev) => new Set(prev).add(ts));
    }, [unreadMentionTimestamps, scrollToMessage]);

    const scrollToNextReaction = useCallback(() => {
      if (unreadReactionTargets.length === 0) return;
      const idx = reactionIdxRef.current % unreadReactionTargets.length;
      const ts = unreadReactionTargets[idx]!;
      scrollToMessage(ts);
      setDismissedReactions((prev) => new Set(prev).add(ts));
    }, [unreadReactionTargets, scrollToMessage]);

    return (
      <div className="relative h-full">
        <div
          className={`h-full flex flex-col-reverse custom-scrollbar px-3 md:px-6 pb-2 overflow-y-auto [contain:layout_style] ${
            isTouchDevice ? "select-none" : ""
          }`}
          style={isTouchDevice ? NO_CALLOUT_STYLE : undefined}
          ref={messageAreaRef}
          id="scrollableArea"
        >
          {/* Mobile long-press backdrop — portaled to body to escape [contain:layout_style] stacking context */}
          {isTouchDevice &&
            mobileActionFor &&
            createPortal(
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={closeMobileAction}
                onTouchStart={(e) => {
                  e.preventDefault();
                  closeMobileAction();
                }}
              />,
              document.body
            )}

          {/* Mobile emoji bottom sheet — portaled to body to escape [contain:layout_style] stacking context */}
          {isTouchDevice &&
            reactionPickerFor &&
            createPortal(
              <div
                ref={pickerRef}
                className="fixed inset-x-0 bottom-0 z-[65] bg-[#141c2b] rounded-t-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
              >
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-2 mb-1" />
                <ChunkErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="w-full h-[320px] flex items-center justify-center text-blue-400/40 text-sm">
                        Loading...
                      </div>
                    }
                  >
                    <LazyReactionEmojiPicker
                      onSelect={(emoji) => {
                        onReact?.(reactionPickerFor, emoji);
                        closeMobileAction();
                      }}
                      className="w-full h-[320px] flex flex-col overflow-hidden bg-transparent [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.white/10%)]"
                      searchClassName="mx-3 mt-1 mb-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-base placeholder:text-white/30 outline-none focus:border-[#34F080]/50"
                      emojiSize="w-11 h-11 text-2xl"
                      categoryBg="bg-[#141c2b]"
                      autoFocusSearch={false}
                    />
                  </Suspense>
                </ChunkErrorBoundary>
              </div>,
              document.body
            )}

          <div className="flex flex-col-reverse">
            <div className="scroller-end-stub"></div>

            {displayMessages.map((message, i: number) => {
              // Render the "New messages" divider between read and unread messages.
              // In flex-col-reverse, higher indices are visually higher (older), so
              // the divider at unreadDividerIndex appears above the unread block.
              const divider =
                i === unreadDividerIndex && unreadCount > 0 ? (
                  <div
                    key="unread-divider"
                    ref={unreadDividerRef}
                    className="flex items-center gap-3 my-3 px-2"
                  >
                    <div className="flex-1 h-px bg-[#34F080]/40" />
                    <span className="text-xs font-semibold text-[#34F080] whitespace-nowrap">
                      {unreadCount === 1
                        ? "1 new message"
                        : `${unreadCount} new messages`}
                    </span>
                    <div className="flex-1 h-px bg-[#34F080]/40" />
                  </div>
                ) : null;

              const parsed = parseMessageType(message);

              // System log messages render as centered, un-bubbled text
              if (parsed.type === "system") {
                const messageKey =
                  (message as any)._localId ||
                  message.MessageInfo.TimestampNanosString ||
                  `msg-${i}`;
                const actionText =
                  parsed.systemAction === "member-left"
                    ? " left the group"
                    : " joined the group";
                return (
                  <React.Fragment key={messageKey}>
                    {divider}
                    <div className="flex justify-center my-2 px-4">
                      <span className="text-xs text-gray-500 bg-white/5 rounded-full px-3 py-1 text-center">
                        {parsed.systemMembers?.length
                          ? parsed.systemMembers
                              .map((m, j) => (
                                <span key={m.pk}>
                                  {j > 0 &&
                                    (j === parsed.systemMembers!.length - 1
                                      ? " and "
                                      : ", ")}
                                  <span className="text-[#34F080] font-medium">
                                    {m.un || m.pk.slice(0, 8)}
                                  </span>
                                </span>
                              ))
                              .concat([<span key="action">{actionText}</span>])
                          : message.DecryptedMessage || ""}
                      </span>
                    </div>
                  </React.Fragment>
                );
              }

              const IsSender =
                message.IsSender ||
                message.SenderInfo.OwnerPublicKeyBase58Check ===
                  appUser?.PublicKeyBase58Check;

              let senderStyles = "glass-received text-gray-200";
              if (IsSender) {
                senderStyles = "glass-sent text-white";
              }
              if (
                (message.error && !message.DecryptedMessage) ||
                looksLikeEncryptedHex(message.DecryptedMessage)
              ) {
                senderStyles =
                  "bg-white/5 border border-white/10 text-gray-500";
              }

              // For media messages, keep glass style (overflow handled by media components)
              const isMedia = [
                "image",
                "gif",
                "sticker",
                "video",
                "audio",
              ].includes(parsed.type);
              // High-res images/videos get a wider bubble so they're not cramped
              const isWideMedia =
                (parsed.type === "image" || parsed.type === "video") &&
                parsed.mediaWidth !== undefined &&
                parsed.mediaWidth >= 600;
              const isSticker = parsed.type === "sticker";
              if (isSticker) {
                // Stickers float without a bubble (like Telegram/WhatsApp)
                senderStyles = "bg-transparent";
              } else if (isMedia) {
                senderStyles = IsSender
                  ? "glass-sent text-white"
                  : "glass-received text-gray-200";
              }

              // Tip messages use glassmorphism bubbles with colored glow (DESO = blue, USDC = green)
              if (parsed.type === "tip") {
                const isUsdc = parsed.tipCurrency === "USDC";
                senderStyles = isUsdc
                  ? IsSender
                    ? "glass-tip-usdc-sent text-white"
                    : "glass-tip-usdc-received text-gray-200"
                  : IsSender
                  ? "glass-tip-deso-sent text-white"
                  : "glass-tip-deso-received text-gray-200";
              }

              // Emoji-only messages float without a bubble
              const messageText = message.DecryptedMessage || "";
              const isEmojiOnly =
                parsed.type === "text" &&
                !message.error &&
                !!parseEmojiOnlyMessage(messageText);
              if (isEmojiOnly) {
                senderStyles = "";
              }

              // Deleted messages get a muted, dashed-border bubble
              if (parsed.deleted) {
                senderStyles =
                  "bg-white/[0.02] border border-dashed border-white/10 text-gray-500";
              }

              const messageKey =
                (message as any)._localId ||
                message.MessageInfo.TimestampNanosString ||
                `msg-${i}`;
              const reactions =
                reactionsByTimestamp[message.MessageInfo.TimestampNanosString];
              const tips =
                tipsByTimestamp[message.MessageInfo.TimestampNanosString];

              // Message grouping: collapse consecutive messages from the same sender within 5 min.
              // Skip system messages and receipt-style tips — they render separately.
              // Custom-message tips look like regular messages and should group normally.
              const senderKey = message.SenderInfo.OwnerPublicKeyBase58Check;
              const isGroupable = (m: (typeof displayMessages)[0]) => {
                const p = parseMessageType(m);
                if (p.type === "system") return false;
                if (p.type === "tip") return tipHasCustomMessage(p);
                return true;
              };
              let prevMessage: (typeof displayMessages)[0] | undefined;
              for (let j = i + 1; j < displayMessages.length; j++) {
                if (isGroupable(displayMessages[j]!)) {
                  prevMessage = displayMessages[j]!;
                  break;
                }
              }
              let nextMessage: (typeof displayMessages)[0] | undefined;
              for (let j = i - 1; j >= 0; j--) {
                if (isGroupable(displayMessages[j]!)) {
                  nextMessage = displayMessages[j]!;
                  break;
                }
              }

              // Use BigInt for nanosecond timestamp comparison — values exceed Number.MAX_SAFE_INTEGER
              const msgNanos = BigInt(
                message.MessageInfo.TimestampNanosString ||
                  String(message.MessageInfo.TimestampNanos)
              );
              const gapNs = BigInt(GROUP_TIME_GAP_NS);

              const isFirstInGroup = (() => {
                if (!prevMessage) return true;
                if (
                  prevMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey
                )
                  return true;
                const prevNanos = BigInt(
                  prevMessage.MessageInfo.TimestampNanosString ||
                    String(prevMessage.MessageInfo.TimestampNanos)
                );
                const diff =
                  msgNanos > prevNanos
                    ? msgNanos - prevNanos
                    : prevNanos - msgNanos;
                return diff > gapNs;
              })();

              const isLastInGroup = (() => {
                if (!nextMessage) return true;
                if (
                  nextMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey
                )
                  return true;
                const nextNanos = BigInt(
                  nextMessage.MessageInfo.TimestampNanosString ||
                    String(nextMessage.MessageInfo.TimestampNanos)
                );
                const diff =
                  nextNanos > msgNanos
                    ? nextNanos - msgNanos
                    : msgNanos - nextNanos;
                return diff > gapNs;
              })();

              // Grouped bubble border-radius: connected corners for consecutive messages.
              // transition smooths regrouping when new messages arrive.
              const R = 20; // full corner
              const C = 3; // connected corner (adjacent message in group)
              const bubbleRadiusStyle = isEmojiOnly
                ? {}
                : IsSender
                ? {
                    borderTopLeftRadius: R,
                    borderTopRightRadius: isFirstInGroup ? R : C,
                    borderBottomLeftRadius: R,
                    borderBottomRightRadius: isLastInGroup ? R : C,
                    transition: "border-radius 150ms ease-out",
                  }
                : {
                    borderTopLeftRadius: isFirstInGroup ? R : C,
                    borderTopRightRadius: R,
                    borderBottomLeftRadius: isLastInGroup ? R : C,
                    borderBottomRightRadius: R,
                    transition: "border-radius 150ms ease-out",
                  };

              // Invisible spacer matching avatar column width for continuation messages
              const avatarSpacer = (
                <div
                  className={`w-[36px] shrink-0 ${IsSender ? "ml-3" : "mr-3"}`}
                />
              );

              const showActionBar = isTouchDevice
                ? mobileActionFor === messageKey && !reactionPickerFor
                : hoveredMessage === messageKey ||
                  reactionPickerFor === messageKey;

              return (
                <React.Fragment key={messageKey}>
                  {divider}
                  <div
                    data-ts={message.MessageInfo.TimestampNanosString}
                    className={`mx-0 last:pt-4 ${
                      IsSender ? "ml-auto justify-end" : "mr-auto justify-start"
                    } ${
                      isWideMedia
                        ? "max-w-[90%] md:max-w-[70%]"
                        : "max-w-[80%] md:max-w-[65%]"
                    } ${
                      isLastInGroup
                        ? reactions ||
                          tips ||
                          pendingTipTimestamps?.has(
                            message.MessageInfo.TimestampNanosString
                          )
                          ? "mb-4"
                          : "mb-1"
                        : "mb-0.5"
                    } transition-[margin-bottom] duration-150 ease-out inline-flex items-end text-left group ${
                      mobileActionFor === messageKey ? "relative z-50" : ""
                    } ${isTouchDevice ? "mobile-no-select" : ""}`}
                    style={isTouchDevice ? NO_CALLOUT_STYLE : undefined}
                    onTouchStart={
                      isTouchDevice
                        ? (e) => handleTouchStart(e, messageKey)
                        : undefined
                    }
                    onTouchMove={isTouchDevice ? handleTouchMove : undefined}
                    onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const bubble = (
                        e.currentTarget as HTMLElement
                      ).querySelector<HTMLElement>(".relative.inline-block");
                      computeFlip(bubble);
                      activeBubbleRef.current = bubble;
                      if (isTouchDevice) {
                        setReactionPickerFor(null);
                        setMobileActionFor(messageKey);
                      } else {
                        setHoveredMessage(messageKey);
                      }
                    }}
                  >
                    {!IsSender &&
                      (isLastInGroup ? (
                        <div
                          className={`w-[36px] shrink-0 mr-3 transition-[margin] duration-150 ${
                            reactions ||
                            tips ||
                            pendingTipTimestamps?.has(
                              message.MessageInfo.TimestampNanosString
                            )
                              ? "mb-[14px]"
                              : ""
                          }`}
                        >
                          <MessagingDisplayAvatar
                            username={
                              getUsernameByPublicKey[
                                message.SenderInfo.OwnerPublicKeyBase58Check
                              ]
                            }
                            publicKey={
                              message.SenderInfo.OwnerPublicKeyBase58Check
                            }
                            extraDataPicUrl={
                              profilePicByPublicKey?.[
                                message.SenderInfo.OwnerPublicKeyBase58Check
                              ]
                            }
                            diameter={36}
                            classNames="relative"
                            onUserClick={handleUserActionClick(
                              message.SenderInfo.OwnerPublicKeyBase58Check,
                              getUsernameByPublicKey[
                                message.SenderInfo.OwnerPublicKeyBase58Check
                              ]
                            )}
                          />
                        </div>
                      ) : (
                        avatarSpacer
                      ))}
                    <div
                      className={`w-full ${
                        IsSender ? "text-right" : "text-left"
                      }`}
                    >
                      {/* Message bubble */}
                      <div className="relative inline-block">
                        <div
                          className={`${senderStyles} mt-auto ${
                            isMedia
                              ? "p-0"
                              : isEmojiOnly
                              ? "p-0"
                              : parsed.deleted
                              ? "py-3 px-5"
                              : "py-1.5 px-3 md:px-4"
                          } break-words ${
                            isMedia || isEmojiOnly
                              ? "inline-flex flex-col items-stretch"
                              : "inline-block"
                          } text-left relative overflow-hidden`}
                          style={bubbleRadiusStyle}
                        >
                          {/* Sender name inside bubble (Telegram-style) */}
                          {isFirstInGroup && !IsSender && (
                            <div
                              className={`${
                                isMedia ? "px-3 pt-1.5 pb-0.5" : "mb-0.5"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={handleUserActionClick(
                                  message.SenderInfo.OwnerPublicKeyBase58Check,
                                  getUsernameByPublicKey[
                                    message.SenderInfo.OwnerPublicKeyBase58Check
                                  ]
                                )}
                                className="text-[#34F080] text-[11px] font-semibold hover:underline cursor-pointer"
                              >
                                {getUsernameByPublicKey[
                                  message.SenderInfo.OwnerPublicKeyBase58Check
                                ]
                                  ? getUsernameByPublicKey[
                                      message.SenderInfo
                                        .OwnerPublicKeyBase58Check
                                    ]
                                  : shortenLongWord(
                                      message.SenderInfo
                                        .OwnerPublicKeyBase58Check
                                    )}
                              </button>
                            </div>
                          )}
                          {/* Reply preview inside the bubble (Telegram-style) */}
                          {parsed.replyTo && parsed.replyPreview && (
                            <div
                              className={`mb-1.5 ${
                                isMedia ? "px-3 pt-2" : "mt-0.5"
                              }`}
                            >
                              <ReplyPreview
                                replyPreview={
                                  looksLikeEncryptedHex(parsed.replyPreview)
                                    ? visibleMessages.find(
                                        (m) =>
                                          m.MessageInfo.TimestampNanosString ===
                                          parsed.replyTo
                                      )?.DecryptedMessage || parsed.replyPreview
                                    : parsed.replyPreview
                                }
                                replySender={parsed.replySender}
                                translatedReplyPreview={
                                  !showingOriginalKeys.has(messageKey)
                                    ? translations.get(`reply:${messageKey}`)
                                        ?.text
                                    : undefined
                                }
                                onClick={() => {
                                  if (!scrollToMessage(parsed.replyTo!)) {
                                    onScrollToReply?.(parsed.replyTo!);
                                  }
                                }}
                              />
                            </div>
                          )}
                          <MessageContent
                            message={message}
                            tipRecipientUsername={
                              parsed.tipRecipient
                                ? getUsernameByPublicKey[parsed.tipRecipient]
                                : undefined
                            }
                            tipRecipientPicUrl={
                              parsed.tipRecipient
                                ? profilePicByPublicKey?.[parsed.tipRecipient]
                                : undefined
                            }
                            translatedText={translations.get(messageKey)?.text}
                            translatedSourceLang={
                              translations.get(messageKey)?.sourceLang
                            }
                            showingOriginal={showingOriginalKeys.has(
                              messageKey
                            )}
                            onToggleOriginal={() => toggleOriginal(messageKey)}
                          />
                          {/* Inline timestamp: invisible spacer reserves room, real timestamp is absolute-positioned */}
                          {(() => {
                            const msgText = message.DecryptedMessage || "";
                            const mediaHasCaption =
                              isMedia &&
                              (() => {
                                if (parsed.type === "image")
                                  return (
                                    !!msgText &&
                                    !/\.\w{2,5}$/.test(msgText.trim())
                                  );
                                if (parsed.type === "gif")
                                  return (
                                    !!msgText &&
                                    msgText !== parsed.gifTitle &&
                                    msgText !== "GIF"
                                  );
                                if (parsed.type === "video")
                                  return !!msgText && msgText !== "video";
                                return false;
                              })();
                            // Deleted messages render their own inline timestamp via MessageContent
                            if (parsed.deleted) return null;
                            const timestampInside =
                              (!isMedia && !isEmojiOnly) || mediaHasCaption;
                            const paidLabel =
                              !IsSender &&
                              parsed.paidDm &&
                              parsed.paidAmountUsdCents
                                ? `$${(parsed.paidAmountUsdCents / 100).toFixed(
                                    2
                                  )} paid · `
                                : "";
                            const timeText = `${paidLabel}${
                              parsed.edited && !parsed.deleted
                                ? "(edited) "
                                : ""
                            }${convertTstampToDateTime(
                              message.MessageInfo.TimestampNanos
                            )}`;
                            const timeColor = parsed.deleted
                              ? "text-white/25"
                              : IsSender
                              ? "text-[#34F080]/50"
                              : "text-gray-500/80";

                            const isPinnedMsg =
                              pinnedMessageTimestamp ===
                              message.MessageInfo.TimestampNanosString;
                            if (timestampInside && !isMedia) {
                              // Telegram-style float: sits on the same line as short text,
                              // drops to its own right-aligned line when the text fills the width.
                              return (
                                <span className="float-right ml-3 leading-none">
                                  <span
                                    className={`${timeColor} text-[10px] whitespace-nowrap inline-flex items-center gap-0.5`}
                                    title={new Date(
                                      message.MessageInfo.TimestampNanos / 1e6
                                    ).toLocaleString()}
                                  >
                                    {isPinnedMsg && (
                                      <Pin className="w-2.5 h-2.5 inline-block" />
                                    )}
                                    {timeText}
                                  </span>
                                </span>
                              );
                            }
                            if (timestampInside && isMedia) {
                              // Media with caption: timestamp below caption
                              return (
                                <div className="flex justify-end mt-0.5 px-3 pb-1.5">
                                  <span
                                    className={`${timeColor} text-[10px] whitespace-nowrap leading-none`}
                                    title={new Date(
                                      message.MessageInfo.TimestampNanos / 1e6
                                    ).toLocaleString()}
                                  >
                                    {timeText}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Timestamp outside bubble — only for bare media (no caption) and emoji-only */}
                        {(() => {
                          if (parsed.deleted) return null;
                          const msgText = message.DecryptedMessage || "";
                          const mediaHasCaption =
                            isMedia &&
                            (() => {
                              if (parsed.type === "image")
                                return (
                                  !!msgText &&
                                  !/\.\w{2,5}$/.test(msgText.trim())
                                );
                              if (parsed.type === "gif")
                                return (
                                  !!msgText &&
                                  msgText !== parsed.gifTitle &&
                                  msgText !== "GIF"
                                );
                              if (parsed.type === "video")
                                return !!msgText && msgText !== "video";
                              return false;
                            })();
                          const timestampOutside =
                            (isMedia && !mediaHasCaption) || isEmojiOnly;

                          if (timestampOutside) {
                            return (
                              <div
                                className={`text-[10px] mt-0.5 px-1 text-right ${
                                  IsSender
                                    ? "text-[#34F080]/50"
                                    : "text-gray-500/80"
                                }`}
                                title={new Date(
                                  message.MessageInfo.TimestampNanos / 1e6
                                ).toLocaleString()}
                              >
                                {parsed.edited && !parsed.deleted
                                  ? "(edited) "
                                  : ""}
                                {convertTstampToDateTime(
                                  message.MessageInfo.TimestampNanos
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Status indicator – shown on every sender message with _status to
                          avoid the indicator "jumping" between bubbles when grouping changes.
                          Last-in-group: hangs below the bubble (mb-4 gap has room).
                          Mid-group: sits inside the bubble bottom-right to avoid overlapping next bubble.
                          Audio processing bubbles have their own internal spinner, so skip the external one. */}
                        {IsSender &&
                          (message as any)._status &&
                          !(
                            parsed.type === "audio" &&
                            (message as any)._status === "processing"
                          ) && (
                            <div
                              className={`absolute z-10 ${
                                isLastInGroup ||
                                (message as any)._status === "failed"
                                  ? "-bottom-4 right-0"
                                  : "bottom-0.5 right-1.5"
                              }`}
                            >
                              <MessageStatusIndicator
                                status={(message as any)._status}
                                onRetry={
                                  (message as any)._localId &&
                                  (message as any)._status === "failed"
                                    ? () => onRetry?.((message as any)._localId)
                                    : undefined
                                }
                                onDelete={
                                  (message as any)._localId &&
                                  (message as any)._status === "failed"
                                    ? () =>
                                        onDeleteFailed?.(
                                          (message as any)._localId
                                        )
                                    : undefined
                                }
                              />
                            </div>
                          )}

                        {/* Telegram-style split: reactions above bubble, action menu below */}
                        {showActionBar &&
                          !parsed.deleted &&
                          (() => {
                            // Reactions row — portaled above the bubble
                            const reactionsRow = onReact
                              ? createPortal(
                                  <div
                                    ref={actionBarRef}
                                    className="fixed z-50"
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      className={`flex items-center gap-0.5 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg ${
                                        isMobile ? "px-1.5 py-1.5" : "px-1 py-1"
                                      }`}
                                    >
                                      {/* Micro-tip button — first, before emoji reactions */}
                                      {onMicroTip && !IsSender && (
                                        <>
                                          <div className="relative">
                                            <button
                                              onClick={() => {
                                                if (showTipTooltip) {
                                                  setShowTipTooltip(false);
                                                  try {
                                                    localStorage.setItem(
                                                      "hasSeenTipTooltip",
                                                      "1"
                                                    );
                                                  } catch {
                                                    /* ignore storage errors */
                                                  }
                                                }
                                                if (navigator.vibrate)
                                                  navigator.vibrate(10);
                                                onMicroTip(message);
                                                closeMobileAction();
                                              }}
                                              aria-label={`Tip $0.01 ${
                                                microTipIsDeso ? "DESO" : "USDC"
                                              }`}
                                              className={`${
                                                isMobile
                                                  ? "h-11 px-2"
                                                  : "h-9 px-1.5"
                                              } flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors`}
                                              style={{
                                                backgroundColor: `${microTipColor}15`,
                                                border: `1px solid ${microTipColor}33`,
                                              }}
                                              title={`Tip $0.01 ${
                                                microTipIsDeso ? "DESO" : "USDC"
                                              }`}
                                            >
                                              <CircleDollarSign
                                                className={`${
                                                  isMobile
                                                    ? "w-5 h-5"
                                                    : "w-4 h-4"
                                                } ${microTipTextColor}`}
                                              />
                                              <span
                                                className={`${microTipTextColor} text-[10px] font-semibold leading-none mt-0.5`}
                                              >
                                                $0.01
                                              </span>
                                            </button>
                                            {showTipTooltip && (
                                              <div
                                                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[180px] px-3 py-2 bg-[#1a2436] rounded-lg shadow-lg text-[11px] text-gray-300 text-center z-50 pointer-events-none"
                                                style={{
                                                  border: `1px solid ${microTipColor}50`,
                                                }}
                                              >
                                                <span
                                                  className={`${microTipTextColor} font-semibold`}
                                                >
                                                  Tip $0.01
                                                </span>{" "}
                                                — send a penny to show
                                                appreciation
                                              </div>
                                            )}
                                          </div>
                                          <div className="w-px self-stretch my-1.5 mx-1 bg-white/10" />
                                        </>
                                      )}
                                      {QUICK_REACTIONS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => {
                                            onReact(
                                              message.MessageInfo
                                                .TimestampNanosString,
                                              emoji
                                            );
                                            setReactionPickerFor(null);
                                            closeMobileAction();
                                          }}
                                          className={`${
                                            isMobile ? "w-11 h-11" : "w-9 h-9"
                                          } flex items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer transition-colors leading-none`}
                                        >
                                          <AnimatedEmoji
                                            emoji={emoji}
                                            size={isMobile ? 28 : 24}
                                            eager
                                          />
                                        </button>
                                      ))}
                                      <button
                                        onClick={() =>
                                          setReactionPickerFor(
                                            reactionPickerFor === messageKey
                                              ? null
                                              : messageKey
                                          )
                                        }
                                        className={`${
                                          isMobile ? "w-11 h-11" : "w-9 h-9"
                                        } flex items-center justify-center hover:bg-white/10 rounded-lg cursor-pointer transition-colors`}
                                        title="More reactions"
                                      >
                                        <Plus
                                          className={`${
                                            isMobile ? "w-5 h-5" : "w-4 h-4"
                                          } text-gray-400`}
                                        />
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                )
                              : null;

                            // Action menu — portaled below the bubble
                            const actionMenu = createPortal(
                              <div
                                ref={actionMenuRef}
                                className={`fixed z-50 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg overscroll-contain ${
                                  isMobile
                                    ? "py-1.5 min-w-[200px]"
                                    : "py-1 min-w-[180px]"
                                } ${isTouchDevice ? "mobile-no-select" : ""}`}
                                style={
                                  isTouchDevice ? NO_CALLOUT_STYLE : undefined
                                }
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                              >
                                {onReply &&
                                  !(
                                    message.DecryptedMessage &&
                                    looksLikeEncryptedHex(
                                      message.DecryptedMessage
                                    )
                                  ) && (
                                    <button
                                      onClick={() => {
                                        onReply(message);
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <Reply className="w-4 h-4 text-gray-400 shrink-0" />
                                      Reply
                                    </button>
                                  )}
                                {message.DecryptedMessage &&
                                  parsed.type !== "reaction" && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          message.DecryptedMessage
                                        );
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <Copy className="w-4 h-4 text-gray-400 shrink-0" />
                                      Copy
                                    </button>
                                  )}
                                {onPin &&
                                  !(message as any)._localId &&
                                  parsed.type !== "reaction" &&
                                  (() => {
                                    const isPinned =
                                      pinnedMessageTimestamp ===
                                      message.MessageInfo.TimestampNanosString;
                                    return (
                                      <button
                                        onClick={() => {
                                          onPin(
                                            isPinned
                                              ? ""
                                              : message.MessageInfo
                                                  .TimestampNanosString,
                                            isPinned
                                              ? undefined
                                              : message.DecryptedMessage
                                          );
                                          closeMobileAction();
                                        }}
                                        className={`w-full flex items-center gap-3 ${
                                          isMobile ? "px-4 py-3" : "px-3 py-2"
                                        } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                      >
                                        {isPinned ? (
                                          <PinOff className="w-4 h-4 text-gray-400 shrink-0" />
                                        ) : (
                                          <Pin className="w-4 h-4 text-gray-400 shrink-0" />
                                        )}
                                        {isPinned
                                          ? "Unpin Message"
                                          : "Pin Message"}
                                      </button>
                                    );
                                  })()}
                                {message.DecryptedMessage &&
                                  parsed.type === "text" &&
                                  !IsSender && (
                                    <button
                                      onClick={() => {
                                        translateMessage(message);
                                        closeMobileAction();
                                      }}
                                      disabled={translatingKeys.has(messageKey)}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors disabled:opacity-50`}
                                    >
                                      {translatingKeys.has(messageKey) ? (
                                        <Loader2 className="w-4 h-4 text-gray-400 shrink-0 animate-spin" />
                                      ) : (
                                        <Languages className="w-4 h-4 text-gray-400 shrink-0" />
                                      )}
                                      {translations.has(messageKey)
                                        ? "Show Original"
                                        : "Translate"}
                                    </button>
                                  )}
                                {onPrivateMessage &&
                                  !IsSender &&
                                  conversation.ChatType !== ChatType.DM &&
                                  !(message as any)._localId && (
                                    <button
                                      onClick={() => {
                                        onPrivateMessage(
                                          message.SenderInfo
                                            .OwnerPublicKeyBase58Check
                                        );
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 min-w-0 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                                      <span className="truncate">
                                        Message{" "}
                                        {getUsernameByPublicKey[
                                          message.SenderInfo
                                            .OwnerPublicKeyBase58Check
                                        ]
                                          ? `@${
                                              getUsernameByPublicKey[
                                                message.SenderInfo
                                                  .OwnerPublicKeyBase58Check
                                              ]
                                            }`
                                          : "privately"}
                                      </span>
                                    </button>
                                  )}
                                {onTip &&
                                  !IsSender &&
                                  !(message as any)._localId && (
                                    <>
                                      <div className="mx-3 my-1 h-px bg-white/8" />
                                      <div
                                        className={`${
                                          isMobile ? "px-4 py-2" : "px-3 py-1.5"
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                          <CircleDollarSign
                                            className="w-3.5 h-3.5 shrink-0"
                                            style={{ color: microTipColor }}
                                          />
                                          <span
                                            className="text-[11px] font-semibold uppercase tracking-wider"
                                            style={{
                                              color: `${microTipColor}99`,
                                            }}
                                          >
                                            Tip
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {[0.25, 1, 5].map((amt) => (
                                            <button
                                              key={amt}
                                              onClick={() => {
                                                onTip(message, amt);
                                                closeMobileAction();
                                              }}
                                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:brightness-125"
                                              style={{
                                                backgroundColor: `${microTipColor}15`,
                                                border: `1px solid ${microTipColor}33`,
                                                color: microTipColor,
                                              }}
                                            >
                                              ${amt < 1 ? amt.toFixed(2) : amt}
                                            </button>
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => {
                                            onTip(message);
                                            closeMobileAction();
                                          }}
                                          className="w-full mt-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:brightness-125"
                                          style={{
                                            backgroundColor: `${microTipColor}15`,
                                            border: `1px solid ${microTipColor}33`,
                                            color: microTipColor,
                                          }}
                                        >
                                          Custom Amount
                                        </button>
                                      </div>
                                      <div className="mx-3 my-1 h-px bg-white/8" />
                                    </>
                                  )}
                                {onEdit &&
                                  IsSender &&
                                  parsed.type === "text" &&
                                  !(message as any)._localId && (
                                    <button
                                      onClick={() => {
                                        onEdit(message);
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <Pencil className="w-4 h-4 text-gray-400 shrink-0" />
                                      Edit
                                    </button>
                                  )}
                                {onDeleteForMe &&
                                  !(message as any)._localId && (
                                    <button
                                      onClick={() => {
                                        onDeleteForMe(
                                          message.MessageInfo
                                            .TimestampNanosString
                                        );
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-gray-200 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <Trash2 className="w-4 h-4 text-gray-400 shrink-0" />
                                      Delete for me
                                    </button>
                                  )}
                                {onDeleteForEveryone &&
                                  IsSender &&
                                  !(message as any)._localId && (
                                    <button
                                      onClick={() => {
                                        onDeleteForEveryone(message);
                                        closeMobileAction();
                                      }}
                                      className={`w-full flex items-center gap-3 ${
                                        isMobile ? "px-4 py-3" : "px-3 py-2"
                                      } text-sm text-red-400 hover:bg-white/8 cursor-pointer transition-colors`}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                                      Delete for everyone
                                    </button>
                                  )}
                              </div>,
                              document.body
                            );

                            return (
                              <>
                                {reactionsRow}
                                {actionMenu}
                              </>
                            );
                          })()}

                        {/* Desktop emoji picker — portaled to escape [contain:layout_style] */}
                        {reactionPickerFor === messageKey &&
                          !isTouchDevice &&
                          createPortal(
                            <div ref={pickerRef} className="fixed z-[65]">
                              <ChunkErrorBoundary>
                                <Suspense
                                  fallback={
                                    <div className="w-[352px] h-[300px] flex items-center justify-center bg-[#141c2b] rounded-xl border border-white/10 text-blue-400/40 text-sm">
                                      Loading...
                                    </div>
                                  }
                                >
                                  <LazyReactionEmojiPicker
                                    onSelect={(emoji) => {
                                      onReact?.(
                                        message.MessageInfo
                                          .TimestampNanosString,
                                        emoji
                                      );
                                      closeMobileAction();
                                    }}
                                  />
                                </Suspense>
                              </ChunkErrorBoundary>
                            </div>,
                            document.body
                          )}

                        {/* Reaction pills + Tip pills — inside inline-block wrapper so
                        pills inherit the bubble's width and left-align beneath it */}
                        {(reactions ||
                          tips ||
                          pendingTipTimestamps?.has(
                            message.MessageInfo.TimestampNanosString
                          )) && (
                          <div className="-mt-3 relative z-10 flex flex-wrap items-center gap-1">
                            {reactions && (
                              <ReactionPills
                                reactions={reactions}
                                currentUserKey={appUser?.PublicKeyBase58Check}
                                isSender={IsSender}
                                onReactionClick={(emoji) =>
                                  onReact?.(
                                    message.MessageInfo.TimestampNanosString,
                                    emoji
                                  )
                                }
                                onRemoveReaction={(emoji) =>
                                  onReact?.(
                                    message.MessageInfo.TimestampNanosString,
                                    emoji,
                                    "remove"
                                  )
                                }
                                getUsernameByPublicKey={getUsernameByPublicKey}
                                profilePicByPublicKey={profilePicByPublicKey}
                              />
                            )}
                            {tips && (
                              <TipPills
                                tips={tips}
                                currentUserKey={appUser?.PublicKeyBase58Check}
                                getUsernameByPublicKey={getUsernameByPublicKey}
                                profilePicByPublicKey={profilePicByPublicKey}
                              />
                            )}
                            {pendingTipTimestamps?.has(
                              message.MessageInfo.TimestampNanosString
                            ) && (
                              <div className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                                <span className="text-gray-400 text-[11px] font-semibold">
                                  Tipping...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Own messages don't need avatar — green bubble alignment is enough */}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Unread divider at the very top when ALL messages are unread */}
            {unreadDividerIndex === displayMessages.length &&
              unreadCount > 0 && (
                <div
                  ref={unreadDividerRef}
                  className="flex items-center gap-3 my-3 px-2"
                >
                  <div className="flex-1 h-px bg-[#34F080]/40" />
                  <span className="text-xs font-semibold text-[#34F080] whitespace-nowrap">
                    {unreadCount === 1
                      ? "1 new message"
                      : `${unreadCount} new messages`}
                  </span>
                  <div className="flex-1 h-px bg-[#34F080]/40" />
                </div>
              )}

            {/* Sentinel for infinite scroll */}
            {allowScrolling && (
              <div
                ref={sentinelRef}
                className="py-4 flex items-center justify-center"
              >
                {isLoadingMore && (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#34F080]" />
                    Loading...
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Floating indicators — stacked on the right, above Jump to Latest */}
        <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none">
          {/* Unread reactions to your messages */}
          {unreadReactionTargets.length > 0 && (
            <button
              onClick={scrollToNextReaction}
              className={`pointer-events-auto relative flex items-center justify-center glass-btn-primary rounded-full shadow-[0_0_12px_rgba(52,240,128,0.15)] text-sm cursor-pointer transition-all ${
                isMobile ? "w-11 h-11" : "w-10 h-10"
              }`}
              aria-label={`${unreadReactionTargets.length} unread reaction${
                unreadReactionTargets.length === 1 ? "" : "s"
              }`}
            >
              <Heart
                className="w-5 h-5 text-[#34F080] drop-shadow-[0_0_6px_rgba(52,240,128,0.5)]"
                strokeWidth={2}
              />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#34F080] text-[10px] font-bold text-[#0d1520] px-1 shadow-md">
                {unreadReactionTargets.length}
              </span>
            </button>
          )}
          {/* Unread @mentions */}
          {unreadMentionTimestamps.length > 0 && (
            <button
              onClick={scrollToNextMention}
              className={`pointer-events-auto relative flex items-center justify-center bg-[#141c2b] hover:bg-[#1a2538] border border-[#34F080]/30 rounded-full shadow-lg cursor-pointer transition-all ${
                isMobile ? "w-11 h-11" : "w-10 h-10"
              }`}
              aria-label={`${unreadMentionTimestamps.length} unread mention${
                unreadMentionTimestamps.length === 1 ? "" : "s"
              }`}
            >
              <span className="text-[#34F080] text-sm font-bold">@</span>
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#34F080] text-[10px] font-bold text-[#0d1520] px-1 shadow-md">
                {unreadMentionTimestamps.length}
              </span>
            </button>
          )}
          {/* Jump to latest */}
          {showJumpToLatest && (
            <button
              onClick={scrollToLatest}
              className={`pointer-events-auto flex items-center justify-center bg-[#141c2b] hover:bg-[#1a2538] border border-white/10 rounded-full shadow-lg cursor-pointer transition-all ${
                isMobile ? "w-11 h-11" : "w-10 h-10"
              }`}
              aria-label="Jump to latest"
            >
              <ArrowDown className="w-4 h-4 text-gray-300" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

MessagingBubblesAndAvatar.displayName = "MessagingBubblesAndAvatar";
