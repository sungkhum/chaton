import { useMemo } from "react";
import { marked } from "marked";
import { MentionEntry } from "../../utils/extra-data";

// Configure marked for chat messages
marked.setOptions({
  breaks: true, // Convert \n to <br> (chat-style line breaks)
  gfm: true, // GitHub-flavored markdown (tables, strikethrough, etc.)
});

// Custom renderer to style links and add security attrs
const renderer = new marked.Renderer();
renderer.link = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// Prevent images from rendering inline (could be used for phishing)
renderer.image = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text || href}</a>`;
};

/** Escape special regex characters in a string */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * After markdown rendering, replace @username tokens that appear in the
 * mentions array with highlighted spans.
 */
function highlightMentions(html: string, mentions: MentionEntry[]): string {
  if (mentions.length === 0) return html;
  for (const m of mentions) {
    // Match @username as a whole word (not inside an HTML tag attribute)
    const pattern = new RegExp(`(?<![\\w/])@${escapeRegex(m.un)}(?!\\w)`, "g");
    html = html.replace(
      pattern,
      `<span class="mention-highlight">@${m.un}</span>`
    );
  }
  return html;
}

export function FormattedMessage({
  children,
  mentions,
}: {
  children: string;
  mentions?: MentionEntry[];
}) {
  const html = useMemo(() => {
    let raw = marked.parse(children, { renderer, async: false }) as string;
    // Remove wrapping <p> tags for simple single-line messages to avoid extra spacing
    const trimmed = raw.trim();
    if (
      trimmed.startsWith("<p>") &&
      trimmed.endsWith("</p>") &&
      trimmed.indexOf("<p>", 1) === -1
    ) {
      raw = trimmed.slice(3, -4);
    } else {
      raw = trimmed;
    }
    if (mentions && mentions.length > 0) {
      raw = highlightMentions(raw, mentions);
    }
    return raw;
  }, [children, mentions]);

  return (
    <div
      className="text-md break-words formatted-message"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
