import { useState, useCallback } from "react";

const CDN_BASE =
  "https://fonts.gstatic.com/s/e/notoemoji/latest";

// Emoji codepoints known to NOT have animated versions — populated on 404.
// Persists for the session so we don't retry broken URLs.
const failedCodepoints = new Set<string>();

/**
 * Convert a native emoji string to the underscore-separated hex codepoint
 * format used by Noto Emoji Animation CDN.
 *
 *   "👍"  → "1f44d"
 *   "❤️"  → "2764_fe0f"
 *   "👍🏻" → "1f44d_1f3fb"
 */
export function emojiToCodepoint(emoji: string): string {
  return [...emoji]
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("_");
}

/** Quick check that a single grapheme is an emoji (not a letter/digit/punct). */
const EMOJI_CHAR_RE = /\p{Extended_Pictographic}/u;

/**
 * Detect messages that are purely 1-3 emojis with no other text, and split
 * them into individual emoji strings. Uses Intl.Segmenter so ZWJ sequences
 * like 👨‍💻 and flag emojis like 🇺🇸 count as one unit each.
 *
 * Returns the array of emoji strings, or null if the message isn't emoji-only.
 */
export function parseEmojiOnlyMessage(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  const segments = [...segmenter.segment(trimmed)].map((s) => s.segment);

  if (segments.length < 1 || segments.length > 3) return null;
  if (!segments.every((s) => EMOJI_CHAR_RE.test(s))) return null;

  return segments;
}

interface AnimatedEmojiProps {
  emoji: string;
  /** Pixel size (width & height). Defaults to 20. */
  size?: number;
  className?: string;
  /** Load eagerly instead of lazy. Use for UI that appears on interaction. */
  eager?: boolean;
}

export function AnimatedEmoji({
  emoji,
  size = 20,
  className = "",
  eager = false,
}: AnimatedEmojiProps) {
  const codepoint = emojiToCodepoint(emoji);
  const knownFailed = failedCodepoints.has(codepoint);
  const [failed, setFailed] = useState(knownFailed);

  const handleError = useCallback(() => {
    failedCodepoints.add(codepoint);
    setFailed(true);
  }, [codepoint]);

  if (failed) {
    return (
      <span
        className={className}
        style={{ fontSize: size, lineHeight: 1 }}
        role="img"
        aria-label={emoji}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`${CDN_BASE}/${codepoint}/512.webp`}
      alt={emoji}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      onError={handleError}
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
}
