import { useStore } from "../store";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  GetPaginatedMessagesForDmThreadResponse,
  GetPaginatedMessagesForGroupChatThreadResponse,
} from "deso-protocol";
import { Loader2, Lock, Reply, Plus, Pencil, Trash2 } from "lucide-react";
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

    case "video":
      return parsed.videoUrl ? (
        <VideoMessage
          videoUrl={parsed.videoUrl}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
          duration={parsed.duration}
        />
      ) : (
        <FormattedMessage>{messageToShow}</FormattedMessage>
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

    case "reaction":
      // Reactions are aggregated, not shown as standalone messages
      return null;

    case "text":
    default: {
      const emojiOnly = messageToShow ? parseEmojiOnlyMessage(messageToShow) : null;
      if (emojiOnly) {
        return (
          <span className="flex gap-1 items-center">
            {emojiOnly.map((e, i) => (
              <AnimatedEmoji key={i} emoji={e} size={48} />
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
  const [deleteMenuFor, setDeleteMenuFor] = useState<string | null>(null);
  const [actionBarFlipped, setActionBarFlipped] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const activeBubbleRef = useRef<HTMLElement | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
  const { isMobile } = useMobile();

  // Position desktop emoji picker (portaled to body) near the action bar
  useLayoutEffect(() => {
    const el = pickerRef.current;
    const bubble = activeBubbleRef.current;
    if (!el || !bubble || isMobile) return;

    const bubbleRect = bubble.getBoundingClientRect();
    const scrollArea = messageAreaRef.current;
    const topBound = scrollArea ? scrollArea.getBoundingClientRect().top : 0;
    const elHeight = el.offsetHeight;
    const elWidth = el.offsetWidth;

    // Vertical: above the action bar area, or below if not enough space
    const spaceAbove = bubbleRect.top - topBound;
    if (spaceAbove < elHeight + 60) {
      el.style.top = `${bubbleRect.bottom + 4}px`;
      el.style.bottom = "auto";
    } else {
      el.style.bottom = `${window.innerHeight - bubbleRect.top + 60}px`;
      el.style.top = "auto";
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
      if (pickerRef.current && pickerRef.current.contains(target)) return;
      setDeleteMenuFor(null);
      setHoveredMessage(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [reactionPickerFor, deleteMenuFor, hoveredMessage]);

  // Close mobile action bar on scroll
  useEffect(() => {
    if (!mobileActionFor || !messageAreaRef.current) return;
    const scrollArea = messageAreaRef.current;
    const dismiss = () => {
      setMobileActionFor(null);
      setReactionPickerFor(null);
    };
    scrollArea.addEventListener("scroll", dismiss, { passive: true });
    return () => scrollArea.removeEventListener("scroll", dismiss);
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

  // Position the action bar (portal) near the active message bubble
  useLayoutEffect(() => {
    const bar = actionBarRef.current;
    const bubble = activeBubbleRef.current;
    if (!bar || !bubble) return;
    // Mobile needs mobileActionFor; desktop needs hoveredMessage
    if (isMobile && !mobileActionFor) return;
    if (!isMobile && !hoveredMessage) return;

    // Guard against stale ref (e.g. message list re-rendered)
    const bubbleRect = bubble.getBoundingClientRect();
    if (bubbleRect.width === 0 && bubbleRect.height === 0) return;
    const barWidth = bar.offsetWidth;
    const pad = 12;

    // Vertical: above or below the bubble
    if (actionBarFlipped) {
      bar.style.top = `${bubbleRect.bottom + 4}px`;
      bar.style.bottom = "auto";
    } else {
      bar.style.bottom = `${window.innerHeight - bubbleRect.top + 4}px`;
      bar.style.top = "auto";
    }

    // Horizontal: align with bubble edge, clamped to viewport
    const isSenderMsg = bubbleRect.left + bubbleRect.width / 2 > window.innerWidth / 2;
    let left = isSenderMsg ? bubbleRect.right - barWidth : bubbleRect.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - barWidth - pad));
    bar.style.left = `${left}px`;
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

  // Filter out reaction messages (aggregated) and hidden messages (delete for me)
  const displayMessages = visibleMessages.filter((msg) => {
    const parsed = parseMessageType(msg);
    if (parsed.type === "reaction") return false;
    if (hiddenMessageIds?.has(msg.MessageInfo.TimestampNanosString)) return false;
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
          const IsSender =
            message.IsSender ||
            message.SenderInfo.OwnerPublicKeyBase58Check ===
              appUser?.PublicKeyBase58Check;

          let senderStyles =
            "bg-[#141c2b] border border-white/6 text-gray-200";
          if (IsSender) {
            senderStyles =
              "bg-[#0d2818] border border-[#34F080]/15 text-white";
          }
          if (message.error && !message.DecryptedMessage) {
            senderStyles = "bg-white/5 border border-white/10 text-gray-500";
          }

          // For media messages, use a cleaner bubble style
          const isMedia = ["image", "gif", "sticker", "video"].includes(parsed.type);
          if (isMedia) {
            senderStyles = "overflow-hidden";
          }

          // Emoji-only messages float without a bubble
          const messageText = message.DecryptedMessage || "";
          const isEmojiOnly =
            parsed.type === "text" && !message.error && !!parseEmojiOnlyMessage(messageText);
          if (isEmojiOnly) {
            senderStyles = "";
          }

          const messageKey = message.MessageInfo.TimestampNanosString || `msg-${i}`;
          const isHovered = hoveredMessage === messageKey;
          const reactions = reactionsByTimestamp[message.MessageInfo.TimestampNanosString];

          // Message grouping: collapse consecutive messages from the same sender within 5 min
          const prevMessage = displayMessages[i + 1]; // older message (above on screen)
          const nextMessage = displayMessages[i - 1]; // newer message (below on screen)
          const senderKey = message.SenderInfo.OwnerPublicKeyBase58Check;

          const isFirstInGroup =
            !prevMessage ||
            prevMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey ||
            Math.abs(message.MessageInfo.TimestampNanos - prevMessage.MessageInfo.TimestampNanos) > GROUP_TIME_GAP_NS;

          const isLastInGroup =
            !nextMessage ||
            nextMessage.SenderInfo.OwnerPublicKeyBase58Check !== senderKey ||
            Math.abs(nextMessage.MessageInfo.TimestampNanos - message.MessageInfo.TimestampNanos) > GROUP_TIME_GAP_NS;

          // Grouped bubble border-radius: connected corners for consecutive messages
          const R = 18;  // full corner
          const C = 4;   // connected corner (adjacent message in group)
          const bubbleRadiusStyle = isEmojiOnly
            ? {}
            : IsSender
              ? {
                  borderTopLeftRadius: R,
                  borderTopRightRadius: isFirstInGroup ? R : C,
                  borderBottomLeftRadius: R,
                  borderBottomRightRadius: isLastInGroup ? C : C,
                }
              : {
                  borderTopLeftRadius: isFirstInGroup ? R : C,
                  borderTopRightRadius: R,
                  borderBottomLeftRadius: isLastInGroup ? C : C,
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
                isLastInGroup ? "mb-3" : "mb-px"
              } inline-flex items-start ${
                isFirstInGroup ? "top-[20px]" : ""
              } text-left group ${
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
                {isFirstInGroup && !IsSender && (
                  <header className="flex items-center flex-row-reverse justify-end mb-[3px]">
                    <span className="mx-1"> </span>
                    <div className="text-sm mb-1">
                      <p className="text-[#34F080] text-xs font-semibold">
                        {getUsernameByPublicKey[
                          message.SenderInfo.OwnerPublicKeyBase58Check
                        ]
                          ? getUsernameByPublicKey[message.SenderInfo.OwnerPublicKeyBase58Check]
                          : shortenLongWord(message.SenderInfo.OwnerPublicKeyBase58Check)}
                      </p>
                    </div>
                  </header>
                )}

                {/* Reply preview if this message is a reply */}
                {parsed.replyTo && parsed.replyPreview && (
                  <ReplyPreview replyPreview={parsed.replyPreview} isSender={IsSender} />
                )}

                {/* Message bubble */}
                <div className="relative inline-block">
                  <div
                    className={`${senderStyles} mt-auto py-2.5 px-3 md:px-4 break-words inline-flex text-left relative items-end gap-1.5`}
                    style={bubbleRadiusStyle}
                  >
                    <MessageContent message={message} />
                    {!isMedia && !isEmojiOnly && (
                      <span
                        className="text-gray-500 text-[10px] whitespace-nowrap leading-none shrink-0 ml-2"
                        title={new Date(message.MessageInfo.TimestampNanos / 1e6).toLocaleString()}
                      >
                        {parsed.edited && !parsed.deleted ? "(edited) " : ""}
                        {convertTstampToDateTime(message.MessageInfo.TimestampNanos)}
                      </span>
                    )}
                  </div>

                  {/* Timestamp for media/emoji messages */}
                  {(isMedia || isEmojiOnly) && (
                    <div
                      className={`text-[10px] text-gray-500 mt-0.5 ${IsSender ? "text-right" : "text-left"}`}
                      title={new Date(message.MessageInfo.TimestampNanos / 1e6).toLocaleString()}
                    >
                      {parsed.edited && !parsed.deleted ? "(edited) " : ""}
                      {convertTstampToDateTime(message.MessageInfo.TimestampNanos)}
                    </div>
                  )}

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

                  {/* Telegram-style context menu (right-click on desktop, long-press on mobile) */}
                  {showActionBar && !parsed.deleted && (() => {
                    const actionBar = (
                      <div ref={actionBarRef} className={
                        `fixed z-50 flex ${actionBarFlipped ? "flex-col-reverse" : "flex-col"} items-stretch`
                      }>
                      {/* Quick reactions row */}
                      {onReact && (
                        <div className={`flex items-center gap-0.5 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg ${
                          isMobile ? "px-1.5 py-1.5" : "px-1 py-1"
                        }`}>
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
                      )}

                      {/* Action menu */}
                      <div className={`mt-1 bg-[#1a2436] border border-white/10 rounded-xl shadow-lg ${
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
                      </div>
                    </div>
                    );
                    return createPortal(actionBar, document.body);
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

                {/* Reaction pills */}
                {reactions && (
                  <div className={`mt-1 ${IsSender ? "flex justify-end" : ""}`}>
                    <ReactionPills
                      reactions={reactions}
                      currentUserKey={appUser?.PublicKeyBase58Check}
                      onReactionClick={(emoji) =>
                        onReact?.(message.MessageInfo.TimestampNanosString, emoji)
                      }
                      getUsernameByPublicKey={getUsernameByPublicKey}
                      profilePicByPublicKey={profilePicByPublicKey}
                    />
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
