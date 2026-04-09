import {
  AccessGroupEntryResponse,
  DecryptedMessageEntryResponse,
} from "deso-protocol";

// Generic DeSo message ExtraData keys — any messaging app can adopt these
export const MSG_TYPE = "msg:type";
export const MSG_REPLY_TO = "msg:replyTo";
export const MSG_REPLY_PREVIEW = "msg:replyPreview";
export const MSG_REPLY_SENDER = "msg:replySender";
export const MSG_IMAGE_URL = "msg:imageUrl";
export const MSG_GIF_URL = "msg:gifUrl";
export const MSG_GIF_TITLE = "msg:gifTitle";
export const MSG_MEDIA_WIDTH = "msg:mediaWidth";
export const MSG_MEDIA_HEIGHT = "msg:mediaHeight";
export const MSG_VIDEO_URL = "msg:videoUrl";
export const MSG_AUDIO_URL = "msg:audioUrl";
export const MSG_DURATION = "msg:duration";
export const MSG_FILE_NAME = "msg:fileName";
export const MSG_FILE_SIZE = "msg:fileSize";
export const MSG_FILE_TYPE = "msg:fileType";
export const MSG_FILE_URL = "msg:fileUrl";
export const MSG_FILE_DESCRIPTION = "msg:fileDescription";
export const MSG_OG_TITLE = "msg:ogTitle";
export const MSG_OG_DESCRIPTION = "msg:ogDescription";
export const MSG_OG_IMAGE = "msg:ogImage";
export const MSG_EMOJI = "msg:emoji";
export const MSG_ACTION = "msg:action";
export const MSG_EDITED = "msg:edited";
export const MSG_DELETED = "msg:deleted";
export const MSG_MENTIONS = "msg:mentions";
export const MSG_ENCRYPTED = "msg:encrypted";

// System/log message metadata — any DeSo messaging app can read these
export const MSG_SYSTEM_ACTION = "msg:systemAction";
export const MSG_SYSTEM_MEMBERS = "msg:systemMembers";

// Tip metadata — any DeSo messaging app can read these
export const MSG_TIP_AMOUNT_NANOS = "msg:tipAmountNanos";
export const MSG_TIP_TX_HASH = "msg:tipTxHash";
export const MSG_TIP_REPLY_TO = "msg:tipReplyTo";
export const MSG_TIP_RECIPIENT = "msg:tipRecipient";
export const MSG_TIP_CURRENCY = "msg:tipCurrency";
/** USDC tip amount stored as hex uint256 string (e.g., "0x2386f26fc10000" for 0.01 USDC).
 *  Parse with `BigInt(value)` — NOT `parseInt`. 1 USDC = 1e18 base units. */
export const MSG_TIP_AMOUNT_USDC = "msg:tipAmountUsdc";
/** "true" when the user typed a custom message with their tip. Absent = fallback text only. */
export const MSG_TIP_CUSTOM_MESSAGE = "msg:tipHasCustomMessage";

// Language detection metadata — any DeSo messaging app can read this
export const MSG_LANG = "msg:lang";

/** ExtraData keys always encrypted (reaction privacy — default). */
export const STANDARD_ENCRYPTED_KEYS = [
  MSG_EMOJI,
  MSG_ACTION,
  MSG_AUDIO_URL,
] as const;

/** ExtraData keys encrypted only when the user opts into full privacy mode.
 *  Includes all media URLs, file metadata, reply previews, and mentions. */
export const FULL_ENCRYPTED_KEYS = [
  ...STANDARD_ENCRYPTED_KEYS,
  MSG_IMAGE_URL,
  MSG_GIF_URL,
  MSG_GIF_TITLE,
  MSG_VIDEO_URL,
  MSG_AUDIO_URL,
  MSG_DURATION,
  MSG_MEDIA_WIDTH,
  MSG_MEDIA_HEIGHT,
  MSG_FILE_NAME,
  MSG_FILE_SIZE,
  MSG_FILE_TYPE,
  MSG_FILE_URL,
  MSG_FILE_DESCRIPTION,
  MSG_OG_TITLE,
  MSG_OG_DESCRIPTION,
  MSG_OG_IMAGE,
  MSG_REPLY_PREVIEW,
  MSG_REPLY_SENDER,
  MSG_MENTIONS,
  MSG_TIP_AMOUNT_NANOS,
  MSG_TIP_TX_HASH,
  MSG_TIP_REPLY_TO,
  MSG_TIP_RECIPIENT,
  MSG_TIP_CURRENCY,
  MSG_TIP_AMOUNT_USDC,
] as const;

export type PrivacyMode = "standard" | "full";

/** Return the list of ExtraData keys to encrypt for the given privacy mode. */
export function getEncryptedExtraDataKeys(
  mode: PrivacyMode
): readonly string[] {
  return mode === "full" ? FULL_ENCRYPTED_KEYS : STANDARD_ENCRYPTED_KEYS;
}

// Generic DeSo access group ExtraData keys — any messaging app can adopt these
export const GROUP_IMAGE_URL = "group:imageUrl";
export const GROUP_DISPLAY_NAME = "group:displayName";
export const GROUP_PINNED_MESSAGE = "group:pinnedMessage";
export const GROUP_PINNED_PREVIEW = "group:pinnedPreview";
export const GROUP_MEMBERS_CAN_SHARE = "group:membersCanShare";

export type TipCurrency = "DESO" | "USDC";

export type RichMessageType =
  | "text"
  | "image"
  | "gif"
  | "sticker"
  | "video"
  | "audio"
  | "file"
  | "reaction"
  | "tip"
  | "system";

export type SystemAction = "member-joined" | "member-left";

/** A user mentioned in a message. pk = publicKey, un = username. */
export interface MentionEntry {
  pk: string;
  un: string;
}

export interface ParsedMessage {
  type: RichMessageType;
  text: string;
  imageUrl?: string;
  gifUrl?: string;
  gifTitle?: string;
  videoUrl?: string;
  /** Cloudflare Stream URL for audio messages. */
  audioUrl?: string;
  /** Local-only thumbnail data URL for optimistic video messages (not stored on-chain). */
  localThumbnail?: string;
  duration?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  fileDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  replyTo?: string;
  replyPreview?: string;
  replySender?: string;
  emoji?: string;
  action?: "add" | "remove";
  edited?: boolean;
  deleted?: boolean;
  mentions?: MentionEntry[];
  tipAmountNanos?: number;
  tipAmountUsdcBaseUnits?: string;
  tipCurrency?: TipCurrency;
  tipTxHash?: string;
  tipReplyTo?: string;
  systemAction?: SystemAction;
  /** JSON array of {pk, un} entries for members involved in the system action */
  systemMembers?: MentionEntry[];
  tipRecipient?: string;
  /** True when the user typed a custom message with their tip. */
  tipHasCustomMessage?: boolean;
  /** ISO 639-1 language code detected at send time (e.g., "en", "es"). */
  lang?: string;
}

/**
 * Detect and extract media from DeSo main app (Diamond/Focus) ExtraData format.
 * They use: encryptedVideoURLs / encryptedImageURLs (decrypted by this point)
 * and video.0.width / video.0.height / image.0.width / image.0.height for dimensions.
 */
function parseDeSoAppMedia(extra: Record<string, string>): {
  type?: RichMessageType;
  videoUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  mediaWidth?: number;
  mediaHeight?: number;
} {
  // Audio from DeSo app — encryptedAudioURLs is decrypted to a URL by this point.
  // Check before video since both use Cloudflare Stream.
  const decryptedAudioUrls = extra["encryptedAudioURLs"];
  if (decryptedAudioUrls && !decryptedAudioUrls.startsWith("04")) {
    let audioUrl: string | undefined;
    try {
      const parsed = JSON.parse(decryptedAudioUrls);
      audioUrl = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      audioUrl = decryptedAudioUrls;
    }
    if (audioUrl) {
      return {
        type: "audio",
        audioUrl,
        duration: extra["audio.0.duration"]
          ? parseFloat(extra["audio.0.duration"])
          : undefined,
      };
    }
  }

  // Video from DeSo app — encryptedVideoURLs is decrypted to a URL by this point
  const decryptedVideoUrls = extra["encryptedVideoURLs"];
  if (decryptedVideoUrls && !decryptedVideoUrls.startsWith("04")) {
    // Parse the decrypted value — could be a single URL or JSON array
    let videoUrl: string | undefined;
    try {
      const parsed = JSON.parse(decryptedVideoUrls);
      videoUrl = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      videoUrl = decryptedVideoUrls;
    }
    if (videoUrl) {
      return {
        type: "video",
        videoUrl,
        mediaWidth: extra["video.0.width"]
          ? parseInt(extra["video.0.width"])
          : undefined,
        mediaHeight: extra["video.0.height"]
          ? parseInt(extra["video.0.height"])
          : undefined,
      };
    }
  }

  // Image from DeSo app
  const decryptedImageUrls = extra["encryptedImageURLs"];
  if (decryptedImageUrls && !decryptedImageUrls.startsWith("04")) {
    let imageUrl: string | undefined;
    try {
      const parsed = JSON.parse(decryptedImageUrls);
      imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      imageUrl = decryptedImageUrls;
    }
    if (imageUrl) {
      return {
        type: "image",
        imageUrl,
        mediaWidth: extra["image.0.width"]
          ? parseInt(extra["image.0.width"])
          : undefined,
        mediaHeight: extra["image.0.height"]
          ? parseInt(extra["image.0.height"])
          : undefined,
      };
    }
  }

  return {};
}

function safeParseMentions(raw: string): MentionEntry[] | undefined {
  try {
    return JSON.parse(raw) as MentionEntry[];
  } catch {
    return undefined;
  }
}

export function parseMessageType(
  message: DecryptedMessageEntryResponse
): ParsedMessage {
  const extra = message.MessageInfo?.ExtraData || {};
  let type = (extra[MSG_TYPE] as RichMessageType) || "text";

  // Detect DeSo main app media format (encryptedVideoURLs, encryptedImageURLs)
  const desoAppMedia = parseDeSoAppMedia(extra);

  // DeSo app media overrides type when no msg:type is set
  if (type === "text" && desoAppMedia.type) {
    type = desoAppMedia.type;
  }

  return {
    type,
    text: message.DecryptedMessage || "",
    imageUrl: extra[MSG_IMAGE_URL] || desoAppMedia.imageUrl,
    gifUrl: extra[MSG_GIF_URL],
    gifTitle: extra[MSG_GIF_TITLE],
    videoUrl: extra[MSG_VIDEO_URL] || desoAppMedia.videoUrl,
    audioUrl: extra[MSG_AUDIO_URL] || desoAppMedia.audioUrl,
    localThumbnail: extra["_localThumbnail"],
    duration: extra[MSG_DURATION]
      ? parseFloat(extra[MSG_DURATION])
      : desoAppMedia.duration,
    mediaWidth: extra[MSG_MEDIA_WIDTH]
      ? parseInt(extra[MSG_MEDIA_WIDTH])
      : desoAppMedia.mediaWidth,
    mediaHeight: extra[MSG_MEDIA_HEIGHT]
      ? parseInt(extra[MSG_MEDIA_HEIGHT])
      : desoAppMedia.mediaHeight,
    fileName: extra[MSG_FILE_NAME],
    fileSize: extra[MSG_FILE_SIZE] ? parseInt(extra[MSG_FILE_SIZE]) : undefined,
    fileType: extra[MSG_FILE_TYPE],
    fileUrl: extra[MSG_FILE_URL],
    fileDescription: extra[MSG_FILE_DESCRIPTION],
    ogTitle: extra[MSG_OG_TITLE],
    ogDescription: extra[MSG_OG_DESCRIPTION],
    ogImage: extra[MSG_OG_IMAGE],
    replyTo: extra[MSG_REPLY_TO],
    replyPreview: extra[MSG_REPLY_PREVIEW],
    replySender: extra[MSG_REPLY_SENDER],
    emoji: extra[MSG_EMOJI],
    action: extra[MSG_ACTION] as "add" | "remove" | undefined,
    edited: extra[MSG_EDITED] === "true",
    deleted: extra[MSG_DELETED] === "true",
    mentions: extra[MSG_MENTIONS]
      ? safeParseMentions(extra[MSG_MENTIONS])
      : undefined,
    tipAmountNanos: extra[MSG_TIP_AMOUNT_NANOS]
      ? Number.isFinite(parseInt(extra[MSG_TIP_AMOUNT_NANOS], 10))
        ? parseInt(extra[MSG_TIP_AMOUNT_NANOS], 10)
        : undefined
      : undefined,
    tipAmountUsdcBaseUnits: extra[MSG_TIP_AMOUNT_USDC],
    tipCurrency:
      (extra[MSG_TIP_CURRENCY] as TipCurrency) ||
      (extra[MSG_TIP_AMOUNT_USDC] ? "USDC" : undefined),
    tipTxHash: extra[MSG_TIP_TX_HASH],
    tipReplyTo: extra[MSG_TIP_REPLY_TO],
    tipRecipient: extra[MSG_TIP_RECIPIENT],
    tipHasCustomMessage: extra[MSG_TIP_CUSTOM_MESSAGE] === "true",
    systemAction: extra[MSG_SYSTEM_ACTION] as SystemAction | undefined,
    systemMembers: extra[MSG_SYSTEM_MEMBERS]
      ? safeParseMentions(extra[MSG_SYSTEM_MEMBERS])
      : undefined,
    lang: extra[MSG_LANG] || undefined,
  };
}

/**
 * Look up the group image URL from an access group's ExtraData.
 * Returns the URL string or undefined if not set.
 */
export function getGroupImageUrl(
  allAccessGroups: AccessGroupEntryResponse[],
  ownerPublicKey: string,
  groupKeyName: string
): string | undefined {
  const group = allAccessGroups.find(
    (g) =>
      g.AccessGroupOwnerPublicKeyBase58Check === ownerPublicKey &&
      g.AccessGroupKeyName === groupKeyName
  );
  return group?.ExtraData?.[GROUP_IMAGE_URL] || undefined;
}

/**
 * Look up the group display name from an access group's ExtraData.
 * Returns the display name string or undefined if not set (falls back to AccessGroupKeyName).
 */
export function getGroupDisplayName(
  allAccessGroups: AccessGroupEntryResponse[],
  ownerPublicKey: string,
  groupKeyName: string
): string | undefined {
  const group = allAccessGroups.find(
    (g) =>
      g.AccessGroupOwnerPublicKeyBase58Check === ownerPublicKey &&
      g.AccessGroupKeyName === groupKeyName
  );
  return group?.ExtraData?.[GROUP_DISPLAY_NAME] || undefined;
}

/**
 * Look up the pinned message timestamp from an access group's ExtraData.
 * Returns the TimestampNanosString of the pinned message, or undefined if none.
 */
export function getGroupPinnedMessage(
  allAccessGroups: AccessGroupEntryResponse[],
  ownerPublicKey: string,
  groupKeyName: string
): { timestamp: string; preview?: string } | undefined {
  const group = allAccessGroups.find(
    (g) =>
      g.AccessGroupOwnerPublicKeyBase58Check === ownerPublicKey &&
      g.AccessGroupKeyName === groupKeyName
  );
  const ts = group?.ExtraData?.[GROUP_PINNED_MESSAGE];
  if (!ts) return undefined;
  return {
    timestamp: ts,
    preview: group?.ExtraData?.[GROUP_PINNED_PREVIEW] || undefined,
  };
}

/**
 * Check whether group members are allowed to share the invite link.
 */
export function getGroupMembersCanShare(
  allAccessGroups: AccessGroupEntryResponse[],
  ownerPublicKey: string,
  groupKeyName: string
): boolean {
  const group = allAccessGroups.find(
    (g) =>
      g.AccessGroupOwnerPublicKeyBase58Check === ownerPublicKey &&
      g.AccessGroupKeyName === groupKeyName
  );
  return group?.ExtraData?.[GROUP_MEMBERS_CAN_SHARE] === "true";
}

export function buildExtraData(
  parsed: Partial<ParsedMessage>
): Record<string, string> {
  const extra: Record<string, string> = {};

  if (parsed.type && parsed.type !== "text") extra[MSG_TYPE] = parsed.type;
  if (parsed.imageUrl) extra[MSG_IMAGE_URL] = parsed.imageUrl;
  if (parsed.gifUrl) extra[MSG_GIF_URL] = parsed.gifUrl;
  if (parsed.gifTitle) extra[MSG_GIF_TITLE] = parsed.gifTitle;
  if (parsed.videoUrl) extra[MSG_VIDEO_URL] = parsed.videoUrl;
  if (parsed.audioUrl) extra[MSG_AUDIO_URL] = parsed.audioUrl;
  if (parsed.duration !== undefined)
    extra[MSG_DURATION] = String(parsed.duration);
  if (parsed.mediaWidth !== undefined)
    extra[MSG_MEDIA_WIDTH] = String(parsed.mediaWidth);
  if (parsed.mediaHeight !== undefined)
    extra[MSG_MEDIA_HEIGHT] = String(parsed.mediaHeight);
  if (parsed.fileName) extra[MSG_FILE_NAME] = parsed.fileName;
  if (parsed.fileSize !== undefined)
    extra[MSG_FILE_SIZE] = String(parsed.fileSize);
  if (parsed.fileType) extra[MSG_FILE_TYPE] = parsed.fileType;
  if (parsed.fileUrl) extra[MSG_FILE_URL] = parsed.fileUrl;
  if (parsed.fileDescription)
    extra[MSG_FILE_DESCRIPTION] = parsed.fileDescription;
  if (parsed.ogTitle) extra[MSG_OG_TITLE] = parsed.ogTitle.slice(0, 100);
  if (parsed.ogDescription)
    extra[MSG_OG_DESCRIPTION] = parsed.ogDescription.slice(0, 200);
  if (parsed.ogImage) extra[MSG_OG_IMAGE] = parsed.ogImage;
  if (parsed.replyTo) extra[MSG_REPLY_TO] = parsed.replyTo;
  if (parsed.replyPreview) extra[MSG_REPLY_PREVIEW] = parsed.replyPreview;
  if (parsed.replySender) extra[MSG_REPLY_SENDER] = parsed.replySender;
  if (parsed.emoji) extra[MSG_EMOJI] = parsed.emoji;
  if (parsed.action) extra[MSG_ACTION] = parsed.action;
  if (parsed.edited) extra[MSG_EDITED] = "true";
  if (parsed.deleted) extra[MSG_DELETED] = "true";
  if (parsed.mentions && parsed.mentions.length > 0)
    extra[MSG_MENTIONS] = JSON.stringify(parsed.mentions);
  if (parsed.tipAmountNanos !== undefined)
    extra[MSG_TIP_AMOUNT_NANOS] = String(parsed.tipAmountNanos);
  if (parsed.tipAmountUsdcBaseUnits)
    extra[MSG_TIP_AMOUNT_USDC] = parsed.tipAmountUsdcBaseUnits;
  if (parsed.tipCurrency) extra[MSG_TIP_CURRENCY] = parsed.tipCurrency;
  if (parsed.tipTxHash) extra[MSG_TIP_TX_HASH] = parsed.tipTxHash;
  if (parsed.tipReplyTo) extra[MSG_TIP_REPLY_TO] = parsed.tipReplyTo;
  if (parsed.tipRecipient) extra[MSG_TIP_RECIPIENT] = parsed.tipRecipient;
  if (parsed.tipHasCustomMessage) extra[MSG_TIP_CUSTOM_MESSAGE] = "true";
  if (parsed.systemAction) extra[MSG_SYSTEM_ACTION] = parsed.systemAction;
  if (parsed.systemMembers && parsed.systemMembers.length > 0)
    extra[MSG_SYSTEM_MEMBERS] = JSON.stringify(parsed.systemMembers);

  return extra;
}

/** Matches "Tipped @username" or "Tipped <8-char pubkey>" (old dialog path fallback). */
const DEFAULT_TIP_TEXT_RE = /^Tipped (@\S+|\S{8})$/;
/** Matches "Tipped $X.XX to @username" (micro-tip path fallback). */
const MICRO_TIP_TEXT_RE = /^Tipped \$[\d.]+ to (@\S+|\S{8})$/;

/**
 * Check whether a tip message has a user-written custom message.
 * Uses the explicit `msg:tipHasCustomMessage` flag when present (new messages);
 * falls back to regex matching for old messages sent before the flag existed.
 */
export function tipHasCustomMessage(parsed: ParsedMessage): boolean {
  if (parsed.tipHasCustomMessage) return true;
  const text = parsed.text || "";
  if (!text) return false;
  if (DEFAULT_TIP_TEXT_RE.test(text)) return false;
  if (MICRO_TIP_TEXT_RE.test(text)) return false;
  return true;
}
