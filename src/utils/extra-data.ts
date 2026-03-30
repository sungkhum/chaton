import { AccessGroupEntryResponse, DecryptedMessageEntryResponse } from "deso-protocol";

// Generic DeSo message ExtraData keys — any messaging app can adopt these
export const MSG_TYPE = "msg:type";
export const MSG_REPLY_TO = "msg:replyTo";
export const MSG_REPLY_PREVIEW = "msg:replyPreview";
export const MSG_IMAGE_URL = "msg:imageUrl";
export const MSG_GIF_URL = "msg:gifUrl";
export const MSG_GIF_TITLE = "msg:gifTitle";
export const MSG_MEDIA_WIDTH = "msg:mediaWidth";
export const MSG_MEDIA_HEIGHT = "msg:mediaHeight";
export const MSG_VIDEO_URL = "msg:videoUrl";
export const MSG_DURATION = "msg:duration";
export const MSG_FILE_NAME = "msg:fileName";
export const MSG_FILE_SIZE = "msg:fileSize";
export const MSG_FILE_TYPE = "msg:fileType";
export const MSG_EMOJI = "msg:emoji";
export const MSG_ACTION = "msg:action";
export const MSG_EDITED = "msg:edited";
export const MSG_DELETED = "msg:deleted";

// Generic DeSo access group ExtraData keys — any messaging app can adopt these
export const GROUP_IMAGE_URL = "group:imageUrl";

export type RichMessageType =
  | "text"
  | "image"
  | "gif"
  | "video"
  | "file"
  | "reaction";

export interface ParsedMessage {
  type: RichMessageType;
  text: string;
  imageUrl?: string;
  gifUrl?: string;
  gifTitle?: string;
  videoUrl?: string;
  duration?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyTo?: string;
  replyPreview?: string;
  emoji?: string;
  action?: "add" | "remove";
  edited?: boolean;
  deleted?: boolean;
}

export function parseMessageType(
  message: DecryptedMessageEntryResponse
): ParsedMessage {
  const extra = message.MessageInfo?.ExtraData || {};
  const type = (extra[MSG_TYPE] as RichMessageType) || "text";

  return {
    type,
    text: message.DecryptedMessage || "",
    imageUrl: extra[MSG_IMAGE_URL],
    gifUrl: extra[MSG_GIF_URL],
    gifTitle: extra[MSG_GIF_TITLE],
    videoUrl: extra[MSG_VIDEO_URL],
    duration: extra[MSG_DURATION]
      ? parseFloat(extra[MSG_DURATION])
      : undefined,
    mediaWidth: extra[MSG_MEDIA_WIDTH]
      ? parseInt(extra[MSG_MEDIA_WIDTH])
      : undefined,
    mediaHeight: extra[MSG_MEDIA_HEIGHT]
      ? parseInt(extra[MSG_MEDIA_HEIGHT])
      : undefined,
    fileName: extra[MSG_FILE_NAME],
    fileSize: extra[MSG_FILE_SIZE]
      ? parseInt(extra[MSG_FILE_SIZE])
      : undefined,
    fileType: extra[MSG_FILE_TYPE],
    replyTo: extra[MSG_REPLY_TO],
    replyPreview: extra[MSG_REPLY_PREVIEW],
    emoji: extra[MSG_EMOJI],
    action: extra[MSG_ACTION] as "add" | "remove" | undefined,
    edited: extra[MSG_EDITED] === "true",
    deleted: extra[MSG_DELETED] === "true",
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

export function buildExtraData(
  parsed: Partial<ParsedMessage>
): Record<string, string> {
  const extra: Record<string, string> = {};

  if (parsed.type && parsed.type !== "text") extra[MSG_TYPE] = parsed.type;
  if (parsed.imageUrl) extra[MSG_IMAGE_URL] = parsed.imageUrl;
  if (parsed.gifUrl) extra[MSG_GIF_URL] = parsed.gifUrl;
  if (parsed.gifTitle) extra[MSG_GIF_TITLE] = parsed.gifTitle;
  if (parsed.videoUrl) extra[MSG_VIDEO_URL] = parsed.videoUrl;
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
  if (parsed.replyTo) extra[MSG_REPLY_TO] = parsed.replyTo;
  if (parsed.replyPreview) extra[MSG_REPLY_PREVIEW] = parsed.replyPreview;
  if (parsed.emoji) extra[MSG_EMOJI] = parsed.emoji;
  if (parsed.action) extra[MSG_ACTION] = parsed.action;
  if (parsed.edited) extra[MSG_EDITED] = "true";
  if (parsed.deleted) extra[MSG_DELETED] = "true";

  return extra;
}
