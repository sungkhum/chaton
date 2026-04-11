import { useState, useCallback, useRef, useEffect } from "react";

const CDN_BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest";

// Emoji codepoints known to NOT have animated versions — populated on 404.
// Persists for the session so we don't retry broken URLs.
const failedCodepoints = new Set<string>();

/** Mark a codepoint as failed (called from delegated error handlers). */
export function markEmojiCodepointFailed(cp: string) {
  failedCodepoints.add(cp);
}

/**
 * Convert a native emoji string to the underscore-separated hex codepoint
 * format used by Noto Emoji Animation CDN.
 *
 *   "👍"  → "1f44d"
 *   "❤️"  → "2764_fe0f"
 *   "👍🏻" → "1f44d_1f3fb"
 */
export function emojiToCodepoint(emoji: string): string {
  return [...emoji].map((char) => char.codePointAt(0)!.toString(16)).join("_");
}

/** Quick check that a string contains at least one emoji character. */
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** Reusable grapheme segmenter — stateless, safe to share. */
const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

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

  const segments = [...graphemeSegmenter.segment(trimmed)].map(
    (s) => s.segment
  );

  if (segments.length < 1 || segments.length > 3) return null;
  if (!segments.every((s) => EMOJI_RE.test(s))) return null;

  return segments;
}

/**
 * Replace emoji characters in an HTML string with animated Noto Emoji `<img>` tags.
 * Skips emojis inside <code> and <pre> blocks. Uses Intl.Segmenter so compound
 * emojis (ZWJ sequences, flags, skin tones) are handled as single units.
 *
 * Runs AFTER DOMPurify — the injected `<img>` tags use a hardcoded CDN domain
 * and emoji-only alt text, so no user-controlled content enters attributes.
 */
export function replaceEmojisInHtml(html: string): string {
  if (!EMOJI_RE.test(html)) return html;

  // Split on HTML tags. DOMPurify's output is well-formed (no raw `>` in attrs).
  const parts = html.split(/(<[^>]*>)/);
  let codeDepth = 0;

  return parts
    .map((part, i) => {
      // Odd indices are HTML tags
      if (i % 2 === 1) {
        if (/^<code/i.test(part) || /^<pre/i.test(part)) codeDepth++;
        if (/^<\/code/i.test(part) || /^<\/pre/i.test(part))
          codeDepth = Math.max(0, codeDepth - 1);
        return part;
      }
      // Text content — skip if inside code or no emoji present
      if (codeDepth > 0 || !EMOJI_RE.test(part)) return part;

      return [...graphemeSegmenter.segment(part)]
        .map(({ segment }) => {
          if (!EMOJI_RE.test(segment)) return segment;
          const cp = emojiToCodepoint(segment);
          if (failedCodepoints.has(cp)) return segment;
          return (
            `<img src="${CDN_BASE}/${cp}/512.webp" alt="${segment}"` +
            ' width="20" height="20" loading="lazy" draggable="false"' +
            ' class="inline-block shrink-0" style="width:20px;height:20px;vertical-align:-3px;opacity:0;transition:opacity .15s ease-in"' +
            ` data-cp="${cp}">`
          );
        })
        .join("");
    })
    .join("");
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleError = useCallback(() => {
    failedCodepoints.add(codepoint);
    setFailed(true);
  }, [codepoint]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  // Reset loaded state when emoji changes (component reused with different prop)
  useEffect(() => {
    setLoaded(false);
  }, [codepoint]);

  // Handle already-cached images that fire load synchronously before React attaches the handler
  useEffect(() => {
    if (
      imgRef.current?.complete &&
      imgRef.current.naturalWidth > 0 &&
      !failed
    ) {
      setLoaded(true);
    }
  }, [failed, codepoint]);

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
      ref={imgRef}
      src={`${CDN_BASE}/${codepoint}/512.webp`}
      alt={emoji}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      onError={handleError}
      onLoad={handleLoad}
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        opacity: loaded ? 1 : 0,
        transition: "opacity .15s ease-in",
      }}
    />
  );
}
