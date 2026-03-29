import { DecryptedMessageEntryResponse } from "deso-protocol";

// ExtraData keys for Chattra rich messages
export const CHATTRA_TYPE = "chattra:type";
export const CHATTRA_REPLY_TO = "chattra:replyTo";
export const CHATTRA_REPLY_PREVIEW = "chattra:replyPreview";
export const CHATTRA_IMAGE_URL = "chattra:imageUrl";
export const CHATTRA_GIF_URL = "chattra:gifUrl";
export const CHATTRA_GIF_TITLE = "chattra:gifTitle";
export const CHATTRA_MEDIA_WIDTH = "chattra:mediaWidth";
export const CHATTRA_MEDIA_HEIGHT = "chattra:mediaHeight";
export const CHATTRA_VIDEO_URL = "chattra:videoUrl";
export const CHATTRA_DURATION = "chattra:duration";
export const CHATTRA_FILE_NAME = "chattra:fileName";
export const CHATTRA_FILE_SIZE = "chattra:fileSize";
export const CHATTRA_FILE_TYPE = "chattra:fileType";
export const CHATTRA_EMOJI = "chattra:emoji";
export const CHATTRA_ACTION = "chattra:action";

export type RichMessageType =
  | "text"
  | "image"
  | "gif"
  | "voice-note"
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
}

export function parseMessageType(
  message: DecryptedMessageEntryResponse
): ParsedMessage {
  const extra = message.MessageInfo?.ExtraData || {};
  const type = (extra[CHATTRA_TYPE] as RichMessageType) || "text";

  return {
    type,
    text: message.DecryptedMessage || "",
    imageUrl: extra[CHATTRA_IMAGE_URL],
    gifUrl: extra[CHATTRA_GIF_URL],
    gifTitle: extra[CHATTRA_GIF_TITLE],
    videoUrl: extra[CHATTRA_VIDEO_URL],
    duration: extra[CHATTRA_DURATION]
      ? parseFloat(extra[CHATTRA_DURATION])
      : undefined,
    mediaWidth: extra[CHATTRA_MEDIA_WIDTH]
      ? parseInt(extra[CHATTRA_MEDIA_WIDTH])
      : undefined,
    mediaHeight: extra[CHATTRA_MEDIA_HEIGHT]
      ? parseInt(extra[CHATTRA_MEDIA_HEIGHT])
      : undefined,
    fileName: extra[CHATTRA_FILE_NAME],
    fileSize: extra[CHATTRA_FILE_SIZE]
      ? parseInt(extra[CHATTRA_FILE_SIZE])
      : undefined,
    fileType: extra[CHATTRA_FILE_TYPE],
    replyTo: extra[CHATTRA_REPLY_TO],
    replyPreview: extra[CHATTRA_REPLY_PREVIEW],
    emoji: extra[CHATTRA_EMOJI],
    action: extra[CHATTRA_ACTION] as "add" | "remove" | undefined,
  };
}

export function buildExtraData(
  parsed: Partial<ParsedMessage>
): Record<string, string> {
  const extra: Record<string, string> = {};

  if (parsed.type && parsed.type !== "text") extra[CHATTRA_TYPE] = parsed.type;
  if (parsed.imageUrl) extra[CHATTRA_IMAGE_URL] = parsed.imageUrl;
  if (parsed.gifUrl) extra[CHATTRA_GIF_URL] = parsed.gifUrl;
  if (parsed.gifTitle) extra[CHATTRA_GIF_TITLE] = parsed.gifTitle;
  if (parsed.videoUrl) extra[CHATTRA_VIDEO_URL] = parsed.videoUrl;
  if (parsed.duration !== undefined)
    extra[CHATTRA_DURATION] = String(parsed.duration);
  if (parsed.mediaWidth !== undefined)
    extra[CHATTRA_MEDIA_WIDTH] = String(parsed.mediaWidth);
  if (parsed.mediaHeight !== undefined)
    extra[CHATTRA_MEDIA_HEIGHT] = String(parsed.mediaHeight);
  if (parsed.fileName) extra[CHATTRA_FILE_NAME] = parsed.fileName;
  if (parsed.fileSize !== undefined)
    extra[CHATTRA_FILE_SIZE] = String(parsed.fileSize);
  if (parsed.fileType) extra[CHATTRA_FILE_TYPE] = parsed.fileType;
  if (parsed.replyTo) extra[CHATTRA_REPLY_TO] = parsed.replyTo;
  if (parsed.replyPreview) extra[CHATTRA_REPLY_PREVIEW] = parsed.replyPreview;
  if (parsed.emoji) extra[CHATTRA_EMOJI] = parsed.emoji;
  if (parsed.action) extra[CHATTRA_ACTION] = parsed.action;

  return extra;
}
