import { useCallback, useMemo, useState, useEffect } from "react";
import { MentionEntry } from "../../utils/extra-data";
import { useStore } from "../../store";

// Match internal join links: getchaton.com/join/<code> or localhost:*/join/<code>
const JOIN_LINK_RE = /^https?:\/\/(?:(?:www\.)?getchaton\.com|localhost:\d+)\/join\/([A-Za-z0-9]+)$/;

// ── Lazy-loaded markdown pipeline ──
// marked (~30KB) and DOMPurify (~35KB) are loaded on first render
// instead of eagerly, keeping them out of the critical path.
let renderMarkdown: ((text: string, mentions?: MentionEntry[]) => string) | null = null;
let loadPromise: Promise<void> | null = null;

function loadMarkdownPipeline(): Promise<void> {
  if (renderMarkdown) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = Promise.all([
    import("marked"),
    import("dompurify"),
  ]).then(([{ marked }, { default: DOMPurify }]) => {
    marked.setOptions({ breaks: true, gfm: true });

    const renderer = new marked.Renderer();
    renderer.link = ({ href, text }) => {
      const joinMatch = href.match(JOIN_LINK_RE);
      if (joinMatch) {
        return `<a href="${href}" data-join-code="${joinMatch[1]}" class="internal-join-link">${text}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    renderer.image = ({ href, text }) => {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text || href}</a>`;
    };

    renderMarkdown = (text: string, mentions?: MentionEntry[]) => {
      let raw = marked.parse(text, { renderer, async: false }) as string;
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
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: [
          "a", "b", "i", "em", "strong", "code", "pre", "br", "p", "ul", "ol",
          "li", "blockquote", "del", "s", "span", "h1", "h2", "h3", "h4", "h5",
          "h6", "hr", "table", "thead", "tbody", "tr", "th", "td",
        ],
        ALLOWED_ATTR: [
          "href", "target", "rel", "class", "data-join-code",
        ],
        ALLOW_DATA_ATTR: false,
      });
    };
  });
  return loadPromise;
}

/** Escape special regex characters in a string */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMentions(html: string, mentions: MentionEntry[]): string {
  if (mentions.length === 0) return html;
  for (const m of mentions) {
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
  const [ready, setReady] = useState(!!renderMarkdown);

  useEffect(() => {
    if (!renderMarkdown) {
      loadMarkdownPipeline().then(() => setReady(true));
    }
  }, []);

  const html = useMemo(() => {
    if (!renderMarkdown) return "";
    return renderMarkdown(children, mentions);
  }, [children, mentions, ready]);

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

  // Before markdown loads, show plain text (no flash — loads in ~50ms)
  if (!ready) {
    return (
      <div className="text-md break-words formatted-message inline">
        {children}
      </div>
    );
  }

  return (
    <div
      className="text-md break-words formatted-message inline"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
