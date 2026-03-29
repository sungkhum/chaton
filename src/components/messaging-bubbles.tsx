import { useStore } from "../store";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
  GetPaginatedMessagesForDmThreadResponse,
  GetPaginatedMessagesForGroupChatThreadResponse,
} from "deso-protocol";
import { Loader2, Reply, Plus } from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmojiPicker } from "frimousse";
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

export interface MessagingBubblesProps {
  conversations: ConversationMap;
  conversationPublicKey: string;
  getUsernameByPublicKey: { [k: string]: string };
  onScroll: (e: Array<DecryptedMessageEntryResponse>) => void;
  onReply?: (message: DecryptedMessageEntryResponse) => void;
  onReact?: (timestampNanosString: string, emoji: string) => void;
  onRetry?: (localId: string) => void;
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
  const messageToShow = message.DecryptedMessage || message.error || "";

  switch (parsed.type) {
    case "image":
      return parsed.imageUrl ? (
        <ImageMessage
          imageUrl={parsed.imageUrl}
          width={parsed.mediaWidth}
          height={parsed.mediaHeight}
        />
      ) : (
        <FormattedMessage>{messageToShow}</FormattedMessage>
      );

    case "gif":
      return parsed.gifUrl ? (
        <GifMessage
          gifUrl={parsed.gifUrl}
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
          fileUrl={parsed.imageUrl || ""}
          fileName={parsed.fileName || "File"}
          fileSize={parsed.fileSize}
          fileType={parsed.fileType}
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
      return <FormattedMessage>{messageToShow}</FormattedMessage>;
    }
  }
}

export const MessagingBubblesAndAvatar: FC<MessagingBubblesProps> = ({
  conversations,
  conversationPublicKey,
  getUsernameByPublicKey,
  onScroll,
  onReply,
  onReact,
  onRetry,
}: MessagingBubblesProps) => {
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const { appUser, allAccessGroups, setAllAccessGroups } = useStore();
  const conversation = conversations[conversationPublicKey] ?? { messages: [] };
  const [allowScrolling, setAllowScrolling] = useState<boolean>(true);
  const [visibleMessages, setVisibleMessages] = useState(conversation.messages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [mobileActionFor, setMobileActionFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
  const { isMobile } = useMobile();

  // Close reaction picker on click outside
  useEffect(() => {
    if (!reactionPickerFor) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setReactionPickerFor(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [reactionPickerFor]);

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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Clear mobile action state on conversation switch
  useEffect(() => {
    setMobileActionFor(null);
    setReactionPickerFor(null);
    clearLongPressTimer();
  }, [conversationPublicKey, clearLongPressTimer]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, messageKey: string) => {
      // Clear any existing timer (e.g. multi-touch)
      clearLongPressTimer();
      const touch = e.touches[0];
      longPressPosRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (navigator.vibrate) navigator.vibrate(20);
        setReactionPickerFor(null); // Close picker from previous message
        setMobileActionFor(messageKey);
      }, 300);
    },
    [clearLongPressTimer]
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
    setReactionPickerFor(null);
  }, [clearLongPressTimer]);

  const sentinelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (conversation.messages.length === 0) setAllowScrolling(false);
    setVisibleMessages(conversation.messages);

    const scrollableArea = messageAreaRef.current;
    if (!scrollableArea) return;

    const hasUnreadMessages =
      visibleMessages.length &&
      visibleMessages[0].MessageInfo.TimestampNanosString !==
        conversation.messages[0].MessageInfo.TimestampNanosString;
    const isLastMessageFromMe =
      conversation.messages.length && conversation.messages[0].IsSender;

    if (
      hasUnreadMessages &&
      isLastMessageFromMe &&
      (isMobile || scrollableArea.scrollTop !== 0)
    ) {
      setTimeout(() => {
        const scrollerStub = scrollableArea.querySelector(".scroller-end-stub");
        scrollerStub?.scrollIntoView({ behavior: "smooth" });
      }, 500);
    }
  }, [conversations, conversationPublicKey, isMobile]);

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
    return <div></div>;
  }

  // Filter out reaction messages from visible display (they're aggregated instead)
  const displayMessages = visibleMessages.filter((msg) => {
    const parsed = parseMessageType(msg);
    return parsed.type !== "reaction";
  });

  return (
    <div
      className="h-full flex flex-col-reverse custom-scrollbar px-3 md:px-6 overflow-y-auto"
      ref={messageAreaRef}
      id="scrollableArea"
    >
      {/* Mobile long-press backdrop */}
      {isMobile && mobileActionFor && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onTouchStart={(e) => {
            e.preventDefault();
            closeMobileAction();
          }}
        />
      )}

      {/* Mobile emoji bottom sheet */}
      {isMobile && reactionPickerFor && (
        <div
          ref={pickerRef}
          className="fixed inset-x-0 bottom-0 z-[60] bg-[#141c2b] rounded-t-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-2 mb-1" />
          <EmojiPicker.Root
            onEmojiSelect={(emoji: { emoji: string }) => {
              onReact?.(reactionPickerFor, emoji.emoji);
              closeMobileAction();
            }}
            className="w-full h-[320px] bg-transparent [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.white/10%)]"
          >
            <EmojiPicker.Search
              className="mx-3 mt-1 mb-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-base placeholder:text-white/30 outline-none focus:border-[#34F080]/50"
              placeholder="Search emoji..."
            />
            <EmojiPicker.Viewport className="flex-1 overflow-y-auto px-1">
              <EmojiPicker.Loading className="flex items-center justify-center h-full text-blue-400/40 text-sm">
                Loading...
              </EmojiPicker.Loading>
              <EmojiPicker.Empty className="flex items-center justify-center h-full text-white/40 text-sm">
                No emoji found
              </EmojiPicker.Empty>
              <EmojiPicker.List
                components={{
                  Row: (props) => (
                    <div {...props} className="flex gap-0.5 px-1" />
                  ),
                  Emoji: (props) => (
                    <button
                      {...props}
                      className="flex items-center justify-center w-11 h-11 rounded-md text-2xl hover:bg-white/10 cursor-pointer transition-colors"
                    />
                  ),
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      {...props}
                      className="px-2 py-1.5 text-xs font-semibold text-white/40 sticky top-0 bg-[#141c2b] z-10"
                    >
                      {category.label}
                    </div>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </div>
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
            "bg-[#141c2b] border border-white/6 text-gray-200 rounded-2xl rounded-bl-sm";
          if (IsSender) {
            senderStyles =
              "bg-[#0d2818] border border-[#34F080]/15 text-white rounded-2xl rounded-br-sm";
          }
          if (message.error) {
            senderStyles = "bg-red-500/20 border border-red-500/30 text-red-200 rounded-2xl";
          }

          // For media messages, use a cleaner bubble style
          const isMedia = ["image", "gif", "video"].includes(parsed.type);
          if (isMedia) {
            senderStyles = IsSender
              ? "rounded-2xl rounded-br-sm overflow-hidden"
              : "rounded-2xl rounded-bl-sm overflow-hidden";
          }

          // Emoji-only messages float without a bubble
          const messageText = message.DecryptedMessage || message.error || "";
          const isEmojiOnly =
            parsed.type === "text" && !!parseEmojiOnlyMessage(messageText);
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

          const timestamp = (
            <div
              className={`whitespace-nowrap text-xs text-gray-500 mt-2 ${
                IsSender ? "text-right" : "text-left"
              }`}
            >
              {convertTstampToDateTime(message.MessageInfo.TimestampNanos)}
            </div>
          );

          const messagingDisplayAvatarAndTimestamp = (
            <div className={`flex flex-col ${IsSender ? "ml-3" : "mr-3"} relative`}>
              <MessagingDisplayAvatar
                username={
                  getUsernameByPublicKey[message.SenderInfo.OwnerPublicKeyBase58Check]
                }
                publicKey={message.SenderInfo.OwnerPublicKeyBase58Check}
                diameter={36}
                classNames="relative"
              />
              {timestamp}
            </div>
          );

          // Invisible spacer matching avatar column width for continuation messages
          const avatarSpacer = (
            <div className={`w-[36px] shrink-0 ${IsSender ? "ml-3" : "mr-3"}`} />
          );

          const showActionBar = isMobile
            ? mobileActionFor === messageKey
            : isHovered || reactionPickerFor === messageKey;

          return (
            <div
              className={`mx-0 last:pt-4 ${
                IsSender ? "ml-auto justify-end" : "mr-auto justify-start"
              } max-w-[80%] md:max-w-[65%] ${
                isLastInGroup ? "mb-3" : "mb-0.5"
              } inline-flex items-start ${
                isFirstInGroup ? "top-[20px]" : ""
              } text-left group ${
                mobileActionFor === messageKey ? "relative z-50" : ""
              } ${isMobile ? "select-none" : ""}`}
              style={isMobile ? { WebkitTouchCallout: "none" } : undefined}
              key={messageKey}
              onMouseEnter={() => setHoveredMessage(messageKey)}
              onMouseLeave={() => setHoveredMessage(null)}
              onTouchStart={
                isMobile ? (e) => handleTouchStart(e, messageKey) : undefined
              }
              onTouchMove={isMobile ? handleTouchMove : undefined}
              onTouchEnd={isMobile ? handleTouchEnd : undefined}
              onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
            >
              {!IsSender && (isLastInGroup ? messagingDisplayAvatarAndTimestamp : avatarSpacer)}
              <div className={`w-full ${IsSender ? "text-right" : "text-left"}`}>
                {isFirstInGroup && (
                  <header
                    className={`flex items-center justify-end mb-[3px] ${
                      IsSender ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <span className="mx-1"> </span>
                    <div className="text-sm mb-1">
                      <p className="text-[#34F080] text-xs font-semibold">
                        {getUsernameByPublicKey[
                          message.SenderInfo.OwnerPublicKeyBase58Check
                        ]
                          ? `@${getUsernameByPublicKey[message.SenderInfo.OwnerPublicKeyBase58Check]}`
                          : shortenLongWord(message.SenderInfo.OwnerPublicKeyBase58Check)}
                      </p>
                    </div>
                  </header>
                )}

                {/* Reply preview if this message is a reply */}
                {parsed.replyTo && parsed.replyPreview && (
                  <ReplyPreview replyPreview={parsed.replyPreview} />
                )}

                {/* Message bubble */}
                <div className="relative inline-block">
                  <div
                    className={`${senderStyles} mt-auto mb-1 py-2.5 px-3 md:px-4 break-words inline-flex text-left relative items-center`}
                  >
                    <MessageContent message={message} />
                  </div>

                  {/* Action bar (hover on desktop, long-press on mobile) */}
                  {showActionBar && (
                    <div
                      className={`absolute ${
                        isMobile ? "-top-12" : "-top-8"
                      } ${
                        IsSender ? "right-0" : "left-0"
                      } flex items-center gap-0.5 bg-[#141c2b] border border-white/10 backdrop-blur-md rounded-lg ${
                        isMobile ? "px-1.5 py-1" : "px-1 py-0.5"
                      } shadow-lg z-10`}
                    >
                      {onReply && (
                        <button
                          onClick={() => {
                            onReply(message);
                            closeMobileAction();
                          }}
                          className={`${
                            isMobile
                              ? "w-11 h-11 flex items-center justify-center"
                              : "p-1"
                          } hover:bg-white/10 rounded cursor-pointer`}
                          title="Reply"
                        >
                          <Reply
                            className={`${
                              isMobile ? "w-5 h-5" : "w-3.5 h-3.5"
                            } text-gray-400`}
                          />
                        </button>
                      )}
                      {onReact && (
                        <>
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
                                  ? "w-11 h-11 flex items-center justify-center"
                                  : "p-1"
                              } hover:bg-white/10 rounded cursor-pointer leading-none`}
                            >
                              <AnimatedEmoji
                                emoji={emoji}
                                size={isMobile ? 28 : 20}
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
                              isMobile
                                ? "w-11 h-11 flex items-center justify-center"
                                : "p-1"
                            } hover:bg-white/10 rounded cursor-pointer`}
                            title="More reactions"
                          >
                            <Plus
                              className={`${
                                isMobile ? "w-5 h-5" : "w-3.5 h-3.5"
                              } text-gray-400`}
                            />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Full emoji picker (desktop: absolute, mobile: fixed bottom sheet) */}
                  {reactionPickerFor === messageKey && !isMobile && (
                    <div
                      ref={pickerRef}
                      className={`absolute z-50 ${
                        IsSender ? "right-0" : "left-0"
                      } bottom-full mb-10`}
                    >
                      <EmojiPicker.Root
                        onEmojiSelect={(emoji: { emoji: string }) => {
                          onReact?.(
                            message.MessageInfo.TimestampNanosString,
                            emoji.emoji
                          );
                          setReactionPickerFor(null);
                        }}
                        className="w-[352px] h-[300px] bg-[#141c2b] rounded-xl border border-white/10 [--frimousse-bg:transparent] [--frimousse-border-color:theme(colors.white/10%)]"
                      >
                        <EmojiPicker.Search
                          className="mx-2 mt-2 mb-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#34F080]/50"
                          placeholder="Search emoji..."
                        />
                        <EmojiPicker.Viewport className="flex-1 overflow-y-auto px-1">
                          <EmojiPicker.Loading className="flex items-center justify-center h-full text-blue-400/40 text-sm">
                            Loading...
                          </EmojiPicker.Loading>
                          <EmojiPicker.Empty className="flex items-center justify-center h-full text-white/40 text-sm">
                            No emoji found
                          </EmojiPicker.Empty>
                          <EmojiPicker.List
                            components={{
                              Row: (props) => <div {...props} className="flex gap-0.5 px-1" />,
                              Emoji: (props) => (
                                <button
                                  {...props}
                                  className="flex items-center justify-center w-9 h-9 rounded-md text-xl hover:bg-white/10 cursor-pointer transition-colors"
                                />
                              ),
                              CategoryHeader: ({ category, ...props }) => (
                                <div {...props} className="px-2 py-1.5 text-xs font-semibold text-white/40 sticky top-0 bg-[#141c2b] z-10">
                                  {category.label}
                                </div>
                              ),
                            }}
                          />
                        </EmojiPicker.Viewport>
                      </EmojiPicker.Root>
                    </div>
                  )}
                </div>

                {/* Reaction pills */}
                {reactions && (
                  <div className={`${IsSender ? "flex justify-end" : ""}`}>
                    <ReactionPills
                      reactions={reactions}
                      currentUserKey={appUser?.PublicKeyBase58Check}
                      onReactionClick={(emoji) =>
                        onReact?.(message.MessageInfo.TimestampNanosString, emoji)
                      }
                    />
                  </div>
                )}

                {/* Message status indicator */}
                {IsSender && (message as any)._status && (
                  <div className="flex justify-end -mt-0.5 mb-1">
                    <MessageStatusIndicator
                      status={(message as any)._status}
                      onRetry={(message as any)._localId && (message as any)._status === "failed"
                        ? () => onRetry?.((message as any)._localId)
                        : undefined}
                    />
                  </div>
                )}
              </div>
              {IsSender && (isLastInGroup ? messagingDisplayAvatarAndTimestamp : avatarSpacer)}
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
