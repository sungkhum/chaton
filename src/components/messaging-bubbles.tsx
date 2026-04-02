import { useStore } from "../store";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  GetPaginatedMessagesForDmThreadResponse,
  GetPaginatedMessagesForGroupChatThreadResponse,
} from "deso-protocol";
import { Loader2, Lock, Reply, Plus, Pencil, Trash2, CircleDollarSign } from "lucide-react";
import { FC, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChunkErrorBoundary } from "./shared/chunk-error-boundary";

// bundle-conditional: frimousse only loads when user opens the full emoji search
const LazyReactionEmojiPicker = lazy(() =>
  import("./messages/reaction-emoji-picker").then(m => ({ default: m.ReactionEmojiPicker }))
);
import { toast } from "sonner";
import { useMobile } from "../hooks/useMobile";
import { decryptAccessGroupMessagesWithRetry } from "../services/conversations.service";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MESSAGES_ONE_REQUEST_LIMIT,
} from "../utils/constants";
import { parseMessageType } from "../utils/extra-data";
import { getCachedTipCurrency } from "../services/cache.service";
import { ConversationMap } from "../utils/types";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MessageStatusIndicator } from "./messages/message-status-indicator";
import { ImageMessage } from "./messages/image-message";
import { GifMessage } from "./messages/gif-message";
import { StickerMessage } from "./messages/sticker-message";
import { VideoMessage } from "./messages/video-message";
import { FileMessage } from "./messages/file-message";
import { ReplyPreview } from "./messages/reply-preview";
import { ReactionPills } from "./messages/reaction-pills";
import { TipMessage } from "./messages/tip-message";
import { TipPills } from "./messages/tip-pills";
import { FormattedMessage } from "./messages/formatted-message";
import {
  AnimatedEmoji,
  parseEmojiOnlyMessage,
} from "./messages/animated-emoji";
import { shortenLongWord } from "./search-users";

// rerender-memo-with-default-value: hoisted constant avoids new object each render
const NO_CALLOUT_STYLE = { WebkitTouchCallout: "none" } as React.CSSProperties & { WebkitTouchCallout: string };

export interface MessagingBubblesProps {
  conversations: ConversationMap;
  conversationPublicKey: string;
  getUsernameByPublicKey: { [k: string]: string };
  profilePicByPublicKey?: { [k: string]: string };
  onScroll: (e: Array<DecryptedMessageEntryResponse>) => void;
  onReply?: (message: DecryptedMessageEntryResponse) => void;
  onReact?: (timestampNanosString: string, emoji: string) => void;
  onRetry?: (localId: string) => void;
  onDeleteFailed?: (localId: string) => void;
  onEdit?: (message: DecryptedMessageEntryResponse) => void;
  onDeleteForMe?: (timestampNanosString: string) => void;
  onDeleteForEveryone?: (message: DecryptedMessageEntryResponse) => void;
  onTip?: (message: DecryptedMessageEntryResponse) => void;
  onMicroTip?: (message: DecryptedMessageEntryResponse) => void;
  pendingTipTimestamps?: Set<string>;
  hiddenMessageIds?: Set<string>;
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


function MessageContent({ message }: { message: DecryptedMessageEntryResponse }) {
  const parsed = parseMessageType(message);

  if (parsed.deleted) {
    return (
      <span className="text-gray-500 italic text-sm select-text">
        This message was deleted
      </span>
    );
  }

  if (message.error && !message.DecryptedMessage) {
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
          caption={imageCaption}
        />
      ) : (
        <FormattedMessage>{messageToShow}</FormattedMessage>
      );
    }

    case "gif": {
      // Show caption below GIF if the message text differs from the gif title
      const gifCaption =
        messageToShow && messageToShow !== parsed.gifTitle && messageToShow !== "GIF"
          ? messageToShow
          : undefined;
      return parsed.gifUrl ? (
        <GifMessage
          gifUrl={parsed.gifUrl}
          title={parsed.gifTitle}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
          caption={gifCaption}
        />
      ) : (
        <FormattedMessage>{messageToShow}</FormattedMessage>
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
        <FormattedMessage>{messageToShow}</FormattedMessage>
      );

    case "video": {
      const videoCaption = messageToShow && messageToShow !== "video" ? messageToShow : undefined;
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
            <div className="text-sm mt-1.5 px-3 pb-1 select-text">
              <FormattedMessage>{videoCaption}</FormattedMessage>
            </div>
          )}
        </div>
      ) : (
        <FormattedMessage>{messageToShow}</FormattedMessage>
      );
    }

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

    case "tip":
      return (
        <TipMessage
          amountNanos={parsed.tipAmountNanos || 0}
          amountUsdcBaseUnits={parsed.tipAmountUsdcBaseUnits}
          currency={parsed.tipCurrency}
          message={messageToShow}
          replyPreview={parsed.replyPreview}
          isSender={message.IsSender}
        />
      );

    case "reaction":
      // Reactions are aggregated, not shown as standalone messages
      return null;

    case "system":
      // System messages are rendered inline by the parent (SystemLogMessage)
      return null;

    case "text":
    default: {
      const emojiOnly = messageToShow ? parseEmojiOnlyMessage(messageToShow) : null;
      if (emojiOnly) {
        const emojiSize = emojiOnly.length === 1 ? 64 : emojiOnly.length === 2 ? 48 : 36;
        return (
          <span className="flex gap-1.5 items-center">
            {emojiOnly.map((e, i) => (
              <AnimatedEmoji key={i} emoji={e} size={emojiSize} />
            ))}
          </span>
        );
      }
      return <FormattedMessage mentions={parsed.mentions}>{messageToShow}</FormattedMessage>;
    }
  }
}

export const MessagingBubblesAndAvatar: FC<MessagingBubblesProps> = ({
  conversations,
  conversationPublicKey,
  getUsernameByPublicKey,
  profilePicByPublicKey,
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
  pendingTipTimestamps,
  hiddenMessageIds,
}: MessagingBubblesProps) => {
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const { appUser, allAccessGroups, setAllAccessGroups } = useStore();
  const conversation = conversations[conversationPublicKey] ?? { messages: [] };
  const [allowScrolling, setAllowScrolling] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [mobileActionFor, setMobileActionFor] = useState<string | null>(null);
  const [showTipTooltip, setShowTipTooltip] = useState(() => {
    try { return !localStorage.getItem("hasSeenTipTooltip"); } catch { return false; }
  });
  // Micro-tip button color based on user's preferred currency (DESO=blue, USDC=green)
  const tipCurrencyPref = appUser ? getCachedTipCurrency(appUser.PublicKeyBase58Check) : null;
  const microTipIsDeso = !tipCurrencyPref || tipCurrencyPref === "DESO";
  const microTipColor = microTipIsDeso ? "#2775ca" : "#34F080";
  const microTipTextColor = microTipIsDeso ? "text-[#2775ca]" : "text-[#34F080]";

  // Auto-dismiss tip tooltip after 4 seconds
  useEffect(() => {
    if (!showTipTooltip) return;
    const timer = setTimeout(() => {
      setShowTipTooltip(false);
      try { localStorage.setItem("hasSeenTipTooltip", "1"); } catch {}
    }, 4000);
    return () => clearTimeout(timer);
  }, [showTipTooltip]);
  const [deleteMenuFor, setDeleteMenuFor] = useState<string | null>(null);
  const [actionBarFlipped, setActionBarFlipped] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const activeBubbleRef = useRef<HTMLElement | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
  const { isMobile } = useMobile();

  // Position desktop emoji picker (portaled to body) near the reaction bar
  useLayoutEffect(() => {
    const el = pickerRef.current;
    const bubble = activeBubbleRef.current;
    if (!el || !bubble || isMobile) return;

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
    const isSender = bubbleRect.left + bubbleRect.width / 2 > window.innerWidth / 2;
    let left = isSender ? bubbleRect.right - elWidth : bubbleRect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - elWidth - 8));
    el.style.left = `${left}px`;
  }, [reactionPickerFor, isMobile]);

  // Close reaction picker / delete menu / desktop action bar on click outside
  useEffect(() => {
    if (!reactionPickerFor && !deleteMenuFor && !hoveredMessage) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setReactionPickerFor(null);
      }
      // Don't dismiss action bar when clicking inside it or its sub-menus
      if (actionBarRef.current && actionBarRef.current.contains(target)) return;
      if (actionMenuRef.current && actionMenuRef.current.contains(target)) return;
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
      setMobileActionFor(null);
      setReactionPickerFor(null);
    };
    scrollArea.addEventListener("scroll", dismiss, { passive: true });
    // iOS: keyboard open/close changes visualViewport but not scroll events
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", dismiss);
    return () => {
      scrollArea.removeEventListener("scroll", dismiss);
      if (vv) vv.removeEventListener("resize", dismiss);
    };
  }, [mobileActionFor]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
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
    if (isMobile && !mobileActionFor) return;
    if (!isMobile && !hoveredMessage) return;

    const bubbleRect = bubble.getBoundingClientRect();
    if (bubbleRect.width === 0 && bubbleRect.height === 0) return;

    const scrollArea = messageAreaRef.current;
    const scrollRect = scrollArea?.getBoundingClientRect();
    const pad = 12;
    const minTop = scrollRect ? scrollRect.top : 0;
    const maxBottom = scrollRect ? scrollRect.bottom : window.innerHeight;
    const isSenderMsg = bubbleRect.left + bubbleRect.width / 2 > window.innerWidth / 2;

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

    const barFitsAbove = spaceAbove >= barHeight + gap;
    const menuFitsBelow = spaceBelow >= menuHeight + gap;
    const bothFitAbove = spaceAbove >= barHeight + menuHeight + gap * 3;
    const bothFitBelow = spaceBelow >= barHeight + menuHeight + gap * 3;

    let barTop: number | undefined;
    let menuTop: number | undefined;

    if (barFitsAbove && menuFitsBelow) {
      // Ideal split: reactions above bubble, menu below bubble
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

    if (bar && barTop !== undefined) {
      barTop = Math.max(minTop, Math.min(barTop, maxBottom - barHeight));
      bar.style.top = `${barTop}px`;
      bar.style.bottom = "auto";
      positionHorizontally(bar);
    }

    if (menu && menuTop !== undefined) {
      menuTop = Math.max(minTop, Math.min(menuTop, maxBottom - menuHeight));
      menu.style.top = `${menuTop}px`;
      menu.style.bottom = "auto";
      positionHorizontally(menu);
    }
  }, [mobileActionFor, hoveredMessage, isMobile, actionBarFlipped]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Clear action state and reset scroll on conversation switch
  useEffect(() => {
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
      const touch = e.touches[0];
      longPressPosRef.current = { x: touch.clientX, y: touch.clientY };
      // Capture currentTarget synchronously — React nullifies it after the handler returns
      const target = e.currentTarget as HTMLElement;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (navigator.vibrate) navigator.vibrate(20);
        setReactionPickerFor(null); // Close picker from previous message
        const bubble = target.querySelector<HTMLElement>(".relative.inline-block");
        computeFlip(bubble);
        activeBubbleRef.current = bubble;
        setMobileActionFor(messageKey);
      }, 300);
    },
    [clearLongPressTimer, computeFlip]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!longPressPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - longPressPosRef.current.x;
    const dy = touch.clientY - longPressPosRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const closeMobileAction = useCallback(() => {
    clearLongPressTimer(); // Kill pending timer so bar doesn't reopen
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

  // Aggregate reactions from reaction-type messages
  const reactionsByTimestamp = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const msg of visibleMessages) {
      const parsed = parseMessageType(msg);
      if (parsed.type === "reaction" && parsed.replyTo && parsed.emoji) {
        if (parsed.action === "remove") continue;
        if (!map[parsed.replyTo]) map[parsed.replyTo] = {};
        if (!map[parsed.replyTo][parsed.emoji]) map[parsed.replyTo][parsed.emoji] = [];
        map[parsed.replyTo][parsed.emoji].push(
          msg.SenderInfo.OwnerPublicKeyBase58Check
        );
      }
    }
    return map;
  }, [visibleMessages]);

  // Aggregate tips from tip-type messages (for tip pills on tipped messages)
  const tipsByTimestamp = useMemo(() => {
    const map: Record<string, Array<{ senderPublicKey: string; amountNanos: number; amountUsdcBaseUnits?: string; currency?: "DESO" | "USDC" }>> = {};
    for (const msg of visibleMessages) {
      const parsed = parseMessageType(msg);
      if (parsed.type === "tip" && parsed.tipReplyTo && (parsed.tipAmountNanos || parsed.tipAmountUsdcBaseUnits)) {
        if (!map[parsed.tipReplyTo]) map[parsed.tipReplyTo] = [];
        map[parsed.tipReplyTo].push({
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

    const newestKey = visibleMessages[0].MessageInfo.TimestampNanosString;
    const hadPrevious = prevNewestRef.current !== null;
    const isNewArrival = hadPrevious && newestKey !== prevNewestRef.current;
    prevNewestRef.current = newestKey;

    if (!isNewArrival) return;

    const isLastMessageFromMe = visibleMessages[0].IsSender;
    const scrollableArea = messageAreaRef.current;
    if (!scrollableArea || !isLastMessageFromMe) return;

    // Scroll immediately on next frame — no 500ms delay
    requestAnimationFrame(() => {
      const scrollerStub = scrollableArea.querySelector(".scroller-end-stub");
      scrollerStub?.scrollIntoView({ behavior: "smooth" });
    });
  }, [visibleMessages]);

  const loadMore = useCallback(async () => {
    if (!appUser || isLoadingMore) return;
    if (visibleMessages.length < MESSAGES_ONE_REQUEST_LIMIT) {
      setAllowScrolling(false);
      return;
    }

    setIsLoadingMore(true);

    try {
      const StartTimeStampString =
        visibleMessages[visibleMessages.length - 1].MessageInfo.TimestampNanosString;

      const dmOrGroupChatMessages = await (conversation.ChatType === ChatType.DM
        ? getPaginatedDMThread({
            UserGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            UserGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            PartyGroupOwnerPublicKeyBase58Check: (visibleMessages[0].IsSender
              ? visibleMessages[0].RecipientInfo
              : visibleMessages[0].SenderInfo
            ).OwnerPublicKeyBase58Check,
            PartyGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
            StartTimeStampString,
            MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
          })
        : getPaginatedGroupChatThread({
            UserPublicKeyBase58Check:
              visibleMessages[visibleMessages.length - 1].RecipientInfo
                .OwnerPublicKeyBase58Check,
            AccessGroupKeyName:
              visibleMessages[visibleMessages.length - 1].RecipientInfo
                .AccessGroupKeyName,
            StartTimeStampString,
            MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
          }));

      const messages =
        conversation.ChatType === ChatType.DM
          ? (dmOrGroupChatMessages as GetPaginatedMessagesForDmThreadResponse).ThreadMessages
          : (dmOrGroupChatMessages as GetPaginatedMessagesForGroupChatThreadResponse).GroupChatMessages;

      const publicKeyToProfileEntryResponseMap =
        dmOrGroupChatMessages.PublicKeyToProfileEntryResponse;
      Object.entries(publicKeyToProfileEntryResponseMap).forEach(
        ([publicKey, profileEntryResponse]) => {
          getUsernameByPublicKey[publicKey] = profileEntryResponse?.Username || "";
        }
      );

      if (messages.length < MESSAGES_ONE_REQUEST_LIMIT) setAllowScrolling(false);
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
  }, [appUser, visibleMessages, conversation, allAccessGroups, isLoadingMore]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !allowScrolling) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root: messageAreaRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [allowScrolling, loadMore]);

  if (Object.keys(conversations).length === 0 || conversationPublicKey === "") {
    return null;
  }

  // Filter out reaction messages (aggregated), hidden messages (delete for me),
  // and small tip messages (≤$5) that are attached to another message (shown on pill instead)
  const SMALL_TIP_DESO_NANOS = 1e9; // ~1 DESO
  const SMALL_TIP_USDC_BASE = 5_000_000; // $5 USDC
  const displayMessages = visibleMessages.filter((msg) => {
    const parsed = parseMessageType(msg);
    if (parsed.type === "reaction") return false;
    if (hiddenMessageIds?.has(msg.MessageInfo.TimestampNanosString)) return false;
    // Hide small tips that are attached to a parent message — they show on the tip pill
    if (parsed.type === "tip" && parsed.tipReplyTo) {
      const isSmallDeso = (!parsed.tipCurrency || parsed.tipCurrency === "DESO")
        && (parsed.tipAmountNanos || 0) <= SMALL_TIP_DESO_NANOS;
      const isSmallUsdc = parsed.tipCurrency === "USDC"
        && BigInt(parsed.tipAmountUsdcBaseUnits || "0") <= BigInt(SMALL_TIP_USDC_BASE);
      if (isSmallDeso || isSmallUsdc) return false;
    }
    return true;
  });

  return (
    <div
      className="h-full flex flex-col-reverse custom-scrollbar px-3 md:px-6 pb-2 overflow-y-auto [contain:layout_style]"
      ref={messageAreaRef}
      id="scrollableArea"
    >
      {/* Mobile long-press backdrop — portaled to body to escape [contain:layout_style] stacking context */}
      {isMobile && mobileActionFor && createPortal(
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
      {isMobile && reactionPickerFor && createPortal(
        <div
          ref={pickerRef}
          className="fixed inset-x-0 bottom-0 z-[65] bg-[#141c2b] rounded-t-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-2 mb-1" />
          <ChunkErrorBoundary>
            <Suspense fallback={
              <div className="w-full h-[320px] flex items-center justify-center text-blue-400/40 text-sm">Loading...</div>
            }>
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
          const parsed = parseMessageType(message);

          // System log messages render as centered, un-bubbled text
          if (parsed.type === "system") {
            const messageKey = (message as any)._localId || message.MessageInfo.TimestampNanosString || `msg-${i}`;
            const actionText = parsed.systemAction === "member-left" ? " left the group" : " joined the group";
            return (
              <div
                key={messageKey}
                className="flex justify-center my-2 px-4"
              >
                <span className="text-xs text-gray-500 bg-white/5 rounded-full px-3 py-1 text-center">
                  {parsed.systemMembers?.length
                    ? parsed.systemMembers.map((m, j) => (
                        <span key={m.pk}>
                          {j > 0 && (j === parsed.systemMembers!.length - 1 ? " and " : ", ")}
                          <span className="text-[#34F080] font-medium">{m.un || m.pk.slice(0, 8)}</span>
                        </span>
                      )).concat([<span key="action">{actionText}</span>])
                    : message.DecryptedMessage || ""}
                </span>
              </div>
            );
          }

          const IsSender =
            message.IsSender ||
            message.SenderInfo.OwnerPublicKeyBase58Check ===
              appUser?.PublicKeyBase58Check;

          let senderStyles =
            "glass-received text-gray-200";
          if (IsSender) {
            senderStyles =
              "glass-sent text-white";
          }
          if (message.error && !message.DecryptedMessage) {
            senderStyles = "bg-white/5 border border-white/10 text-gray-500";
          }

          // For media messages, keep glass style (overflow handled by media components)
          const isMedia = ["image", "gif", "sticker", "video"].includes(parsed.type);
          if (isMedia) {
            senderStyles = IsSender
              ? "glass-sent text-white"
              : "glass-received text-gray-200";
          }

          // Tip messages get a tinted bubble with accent left border (DESO = blue, USDC = green)
          if (parsed.type === "tip") {
            const isUsdc = parsed.tipCurrency === "USDC";
            senderStyles = isUsdc
              ? (IsSender
                  ? "bg-[#082414] border border-[#34F080]/25 text-white border-l-2 border-l-[#34F080]"
                  : "bg-[#081a12] border border-[#34F080]/15 text-gray-200 border-l-2 border-l-[#34F080]")
              : (IsSender
                  ? "bg-[#081424] border border-[#2775ca]/25 text-white border-l-2 border-l-[#2775ca]"
                  : "bg-[#081220] border border-[#2775ca]/15 text-gray-200 border-l-2 border-l-[#2775ca]");
          }

          // Emoji-only messages float without a bubble
          const messageText = message.DecryptedMessage || "";
          const isEmojiOnly =
            parsed.type === "text" && !message.error && !!parseEmojiOnlyMessage(messageText);
          if (isEmojiOnly) {
            senderStyles = "";
          }

          const messageKey = (message as any)._localId || message.MessageInfo.TimestampNanosString || `msg-${i}`;
          const isHovered = hoveredMessage === messageKey;
          const reactions = reactionsByTimestamp[message.MessageInfo.TimestampNanosString];
          const tips = tipsByTimestamp[message.MessageInfo.TimestampNanosString];

          // Message grouping: collapse consecutive messages from the same sender within 5 min
          // Skip system/tip messages — they render separately and shouldn't break visual groups
          const senderKey = message.SenderInfo.OwnerPublicKeyBase58Check;
          const isGroupable = (m: typeof displayMessages[0]) => {
            const t = parseMessageType(m).type;
            return t !== "system" && t !== "tip";
          };
          let prevMessage: typeof displayMessages[0] | undefined;
          for (let j = i + 1; j < displayMessages.length; j++) {
            if (isGroupable(displayMessages[j])) { prevMessage = displayMessages[j]; break; }
          }
          let nextMessage: typeof displayMessages[0] | undefined;
          for (let j = i - 1; j >= 0; j--) {
            if (isGroupable(displayMessages[j])) { nextMessage = displayMessages[j]; break; }
          }

          // Use BigInt for nanosecond timestamp comparison — values exceed Number.MAX_SAFE_INTEGER
          const msgNanos = BigInt(message.MessageInfo.TimestampNanosString || String(message.MessageInfo.TimestampNanos));
          const gapNs = BigInt(GROUP_TIME_GAP_NS);

          const isFirstInGroup = (() => {
            if (!prevMessage) return true;
            if (prevMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey) return true;
            const prevNanos = BigInt(prevMessage.MessageInfo.TimestampNanosString || String(prevMessage.MessageInfo.TimestampNanos));
            const diff = msgNanos > prevNanos ? msgNanos - prevNanos : prevNanos - msgNanos;
            return diff > gapNs;
          })();

          const isLastInGroup = (() => {
            if (!nextMessage) return true;
            if (nextMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey) return true;
            const nextNanos = BigInt(nextMessage.MessageInfo.TimestampNanosString || String(nextMessage.MessageInfo.TimestampNanos));
            const diff = nextNanos > msgNanos ? nextNanos - msgNanos : msgNanos - nextNanos;
            return diff > gapNs;
          })();

          // Grouped bubble border-radius: connected corners for consecutive messages
          const R = 20;  // full corner
          const C = 3;   // connected corner (adjacent message in group)
          const bubbleRadiusStyle = isEmojiOnly
            ? {}
            : IsSender
              ? {
                  borderTopLeftRadius: R,
                  borderTopRightRadius: isFirstInGroup ? R : C,
                  borderBottomLeftRadius: R,
                  borderBottomRightRadius: isLastInGroup ? R : C,
                }
              : {
                  borderTopLeftRadius: isFirstInGroup ? R : C,
                  borderTopRightRadius: R,
                  borderBottomLeftRadius: isLastInGroup ? R : C,
                  borderBottomRightRadius: R,
                };

          const messagingDisplayAvatar = (
            <div className={`w-[36px] shrink-0 ${IsSender ? "ml-3" : "mr-3"}`}>
              <MessagingDisplayAvatar
                username={
                  getUsernameByPublicKey[message.SenderInfo.OwnerPublicKeyBase58Check]
                }
                publicKey={message.SenderInfo.OwnerPublicKeyBase58Check}
                extraDataPicUrl={profilePicByPublicKey?.[message.SenderInfo.OwnerPublicKeyBase58Check]}
                diameter={36}
                classNames="relative"
              />
            </div>
          );

          // Invisible spacer matching avatar column width for continuation messages
          const avatarSpacer = (
            <div className={`w-[36px] shrink-0 ${IsSender ? "ml-3" : "mr-3"}`} />
          );

          const showActionBar = isMobile
            ? mobileActionFor === messageKey && !reactionPickerFor
            : hoveredMessage === messageKey || reactionPickerFor === messageKey;

          return (
            <div
              className={`mx-0 last:pt-4 ${
                IsSender ? "ml-auto justify-end" : "mr-auto justify-start"
              } max-w-[80%] md:max-w-[65%] ${
                isLastInGroup ? "mb-4" : "mb-0.5"
              } inline-flex items-end text-left group ${
                mobileActionFor === messageKey ? "relative z-50" : ""
              } ${isMobile ? "select-none" : ""}`}
              style={isMobile ? NO_CALLOUT_STYLE : undefined}
              key={messageKey}
              onTouchStart={
                isMobile ? (e) => handleTouchStart(e, messageKey) : undefined
              }
              onTouchMove={isMobile ? handleTouchMove : undefined}
              onTouchEnd={isMobile ? handleTouchEnd : undefined}
              onContextMenu={(e) => {
                e.preventDefault();
                const bubble = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".relative.inline-block");
                computeFlip(bubble);
                activeBubbleRef.current = bubble;
                if (isMobile) {
                  setReactionPickerFor(null);
                  setMobileActionFor(messageKey);
                } else {
                  setHoveredMessage(messageKey);
                }
              }}
            >
              {!IsSender && (isLastInGroup ? messagingDisplayAvatar : avatarSpacer)}
              <div className={`w-full ${IsSender ? "text-right" : "text-left"}`}>

                {/* Message bubble */}
                <div className="relative inline-block">
                  <div
                    className={`${senderStyles} mt-auto ${isMedia ? "p-0" : isEmojiOnly ? "p-0" : "py-1.5 px-3 md:px-4"} break-words ${isMedia || isEmojiOnly ? "inline-flex flex-col items-stretch" : "inline-block"} text-left relative`}
                    style={bubbleRadiusStyle}
                  >
                    {/* Sender name inside bubble (Telegram-style) */}
                    {isFirstInGroup && !IsSender && (
                      <div className={`text-[#34F080] text-[11px] font-semibold ${isMedia ? "px-3 pt-1.5 pb-0.5" : "mb-0.5"}`}>
                        {getUsernameByPublicKey[
                          message.SenderInfo.OwnerPublicKeyBase58Check
                        ]
                          ? getUsernameByPublicKey[message.SenderInfo.OwnerPublicKeyBase58Check]
                          : shortenLongWord(message.SenderInfo.OwnerPublicKeyBase58Check)}
                      </div>
                    )}
                    {/* Reply preview inside the bubble (Telegram-style) */}
                    {parsed.replyTo && parsed.replyPreview && (
                      <div className={`mb-1.5 mt-0.5 ${isMedia ? "px-3" : ""}`}>
                        <ReplyPreview replyPreview={parsed.replyPreview} isSender={false} />
                      </div>
                    )}
                    <MessageContent message={message} />
                    {/* Inline timestamp: invisible spacer reserves room, real timestamp is absolute-positioned */}
                    {(() => {
                      const msgText = message.DecryptedMessage || "";
                      const mediaHasCaption = isMedia && (() => {
                        if (parsed.type === "image") return !!msgText && !/\.\w{2,5}$/.test(msgText.trim());
                        if (parsed.type === "gif") return !!msgText && msgText !== parsed.gifTitle && msgText !== "GIF";
                        if (parsed.type === "video") return !!msgText && msgText !== "video";
                        return false;
                      })();
                      const timestampInside = (!isMedia && !isEmojiOnly) || mediaHasCaption;
                      const timeText = `${parsed.edited && !parsed.deleted ? "(edited) " : ""}${convertTstampToDateTime(message.MessageInfo.TimestampNanos)}`;
                      const timeColor = IsSender ? "text-[#34F080]/50" : "text-gray-500/80";

                      if (timestampInside && !isMedia) {
                        // Text messages: float-right timestamp sits inline when room, wraps right when not
                        return (
                          <span className="inline float-right ml-2 mt-1.5 leading-none">
                            <span
                              className={`${timeColor} text-[10px] whitespace-nowrap`}
                              title={new Date(message.MessageInfo.TimestampNanos / 1e6).toLocaleString()}
                            >
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
                              title={new Date(message.MessageInfo.TimestampNanos / 1e6).toLocaleString()}
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
                    const msgText = message.DecryptedMessage || "";
                    const mediaHasCaption = isMedia && (() => {
                      if (parsed.type === "image") return !!msgText && !/\.\w{2,5}$/.test(msgText.trim());
                      if (parsed.type === "gif") return !!msgText && msgText !== parsed.gifTitle && msgText !== "GIF";
                      if (parsed.type === "video") return !!msgText && msgText !== "video";
                      return false;
                    })();
                    const timestampOutside = (isMedia && !mediaHasCaption) || isEmojiOnly;

                    if (timestampOutside) {
                      return (
                        <div
                          className={`text-[10px] mt-0.5 px-1 text-right ${IsSender ? "text-[#34F080]/50" : "text-gray-500/80"}`}
                          title={new Date(message.MessageInfo.TimestampNanos / 1e6).toLocaleString()}
                        >
                          {parsed.edited && !parsed.deleted ? "(edited) " : ""}
                          {convertTstampToDateTime(message.MessageInfo.TimestampNanos)}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Status indicator – absolutely positioned so it never shifts layout */}
                  {IsSender && (message as any)._status && (
                    <div className="absolute -bottom-4 right-0 z-10">
                      <MessageStatusIndicator
                        status={(message as any)._status}
                        onRetry={(message as any)._localId && (message as any)._status === "failed"
                          ? () => onRetry?.((message as any)._localId)
                          : undefined}
                        onDelete={(message as any)._localId && (message as any)._status === "failed"
                          ? () => onDeleteFailed?.((message as any)._localId)
                          : undefined}
                      />
                    </div>
                  )}

                  {/* Telegram-style split: reactions above bubble, action menu below */}
                  {showActionBar && !parsed.deleted && (() => {
                    // Reactions row — portaled above the bubble
                    const reactionsRow = onReact ? createPortal(
                      <div ref={actionBarRef} className="fixed z-50">
                        <div className={`flex items-center gap-0.5 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg ${
                          isMobile ? "px-1.5 py-1.5" : "px-1 py-1"
                        }`}>
                          {/* Micro-tip button — first, before emoji reactions */}
                          {onMicroTip && !IsSender && (
                            <>
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    if (showTipTooltip) {
                                      setShowTipTooltip(false);
                                      try { localStorage.setItem("hasSeenTipTooltip", "1"); } catch {}
                                    }
                                    if (navigator.vibrate) navigator.vibrate(10);
                                    onMicroTip(message);
                                    closeMobileAction();
                                  }}
                                  aria-label={`Tip $0.01 ${microTipIsDeso ? "DESO" : "USDC"}`}
                                  className={`${
                                    isMobile ? "h-11 px-2" : "h-9 px-1.5"
                                  } flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors`}
                                  style={{
                                    backgroundColor: `${microTipColor}15`,
                                    border: `1px solid ${microTipColor}33`,
                                  }}
                                  title={`Tip $0.01 ${microTipIsDeso ? "DESO" : "USDC"}`}
                                >
                                  <CircleDollarSign className={`${isMobile ? "w-5 h-5" : "w-4 h-4"} ${microTipTextColor}`} />
                                  <span className={`${microTipTextColor} text-[10px] font-semibold leading-none mt-0.5`}>$0.01</span>
                                </button>
                                {showTipTooltip && (
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[180px] px-3 py-2 bg-[#1a2436] rounded-lg shadow-lg text-[11px] text-gray-300 text-center z-50 pointer-events-none"
                                    style={{ border: `1px solid ${microTipColor}50` }}>
                                    <span className={`${microTipTextColor} font-semibold`}>Tip $0.01</span> — send a penny to show appreciation
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
                                  message.MessageInfo.TimestampNanosString,
                                  emoji
                                );
                                setReactionPickerFor(null);
                                closeMobileAction();
                              }}
                              className={`${
                                isMobile
                                  ? "w-11 h-11"
                                  : "w-9 h-9"
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
                            <Plus className={`${isMobile ? "w-5 h-5" : "w-4 h-4"} text-gray-400`} />
                          </button>
                        </div>
                      </div>,
                      document.body
                    ) : null;

                    // Action menu — portaled below the bubble
                    const actionMenu = createPortal(
                      <div ref={actionMenuRef} className={`fixed z-50 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg ${
                        isMobile ? "py-1.5 min-w-[200px]" : "py-1 min-w-[180px]"
                      }`}>
                        {onReply && (
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
                        {onTip && !IsSender && !(message as any)._localId && (
                          <button
                            onClick={() => {
                              onTip(message);
                              closeMobileAction();
                            }}
                            className={`w-full flex items-center gap-3 ${
                              isMobile ? "px-4 py-3" : "px-3 py-2"
                            } text-sm text-[#34F080] hover:bg-white/8 cursor-pointer transition-colors`}
                          >
                            <CircleDollarSign className="w-4 h-4 text-[#34F080] shrink-0" />
                            Tip
                          </button>
                        )}
                        {onEdit && IsSender && parsed.type === "text" && !(message as any)._localId && (
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
                        {onDeleteForMe && !(message as any)._localId && (
                          <button
                            onClick={() => {
                              onDeleteForMe(message.MessageInfo.TimestampNanosString);
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
                        {onDeleteForEveryone && IsSender && !(message as any)._localId && (
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

                    return <>{reactionsRow}{actionMenu}</>;
                  })()}

                  {/* Desktop emoji picker — portaled to escape [contain:layout_style] */}
                  {reactionPickerFor === messageKey && !isMobile && createPortal(
                    <div
                      ref={pickerRef}
                      className="fixed z-[65]"
                    >
                      <ChunkErrorBoundary>
                        <Suspense fallback={
                          <div className="w-[352px] h-[300px] flex items-center justify-center bg-[#141c2b] rounded-xl border border-white/10 text-blue-400/40 text-sm">Loading...</div>
                        }>
                          <LazyReactionEmojiPicker
                            onSelect={(emoji) => {
                              onReact?.(
                                message.MessageInfo.TimestampNanosString,
                                emoji
                              );
                              setReactionPickerFor(null);
                            }}
                          />
                        </Suspense>
                      </ChunkErrorBoundary>
                    </div>,
                    document.body
                  )}
                </div>

                {/* Reaction pills + Tip pills */}
                {(reactions || tips || pendingTipTimestamps?.has(message.MessageInfo.TimestampNanosString)) && (
                  <div className={`-mt-1.5 relative z-10 flex flex-wrap items-center gap-1 ${IsSender ? "justify-end" : ""}`}>
                    {reactions && (
                      <ReactionPills
                        reactions={reactions}
                        currentUserKey={appUser?.PublicKeyBase58Check}
                        onReactionClick={(emoji) =>
                          onReact?.(message.MessageInfo.TimestampNanosString, emoji)
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
                    {pendingTipTimestamps?.has(message.MessageInfo.TimestampNanosString) && (
                      <div className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                        <span className="text-gray-400 text-[11px] font-semibold">Tipping...</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
              {/* Own messages don't need avatar — green bubble alignment is enough */}
            </div>
          );
        })}

        {/* Sentinel for infinite scroll */}
        {allowScrolling && (
          <div ref={sentinelRef} className="py-4 flex items-center justify-center">
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
  );
};
