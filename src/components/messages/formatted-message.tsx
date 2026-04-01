import { useCallback, useMemo } from "react";
import { marked } from "marked";
import { MentionEntry } from "../../utils/extra-data";
import { useStore } from "../../store";

// Configure marked for chat messages
marked.setOptions({
  breaks: true, // Convert \n to <br> (chat-style line breaks)
  gfm: true, // GitHub-flavored markdown (tables, strikethrough, etc.)
});

// Match internal join links: getchaton.com/join/<code> or localhost:*/join/<code>
const JOIN_LINK_RE = /^https?:\/\/(?:(?:www\.)?getchaton\.com|localhost:\d+)\/join\/([A-Za-z0-9]+)$/;

// Custom renderer to style links and add security attrs
const renderer = new marked.Renderer();
renderer.link = ({ href, text }) => {
  const joinMatch = href.match(JOIN_LINK_RE);
  if (joinMatch) {
    // Internal join link — handle in-app instead of opening a new tab
    return `<a href="${href}" data-join-code="${joinMatch[1]}" class="internal-join-link">${text}</a>`;
  }
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

  // Intercept clicks on internal join links — open as in-app modal
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest<HTMLAnchorElement>("a[data-join-code]");
    if (anchor) {
      e.preventDefault();
      const code = anchor.dataset.joinCode;
      if (code) {
        useStore.getState().setPendingJoinCode(code);
      }
    }
  }, []);

  return (
    <div
      className="text-md break-words formatted-message"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
