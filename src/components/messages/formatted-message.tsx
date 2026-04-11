import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { MentionEntry } from "../../utils/extra-data";
import { useStore } from "../../store";
import {
  replaceEmojisInHtml,
  markEmojiCodepointFailed,
} from "./animated-emoji";

// Match internal join links: getchaton.com/join/<code> or localhost:*/join/<code>
const JOIN_LINK_RE =
  /^https?:\/\/(?:(?:www\.)?getchaton\.com|localhost:\d+)\/join\/([A-Za-z0-9]+)$/;

// ── Lazy-loaded markdown pipeline ──
// marked (~30KB) and DOMPurify (~35KB) are loaded on first render
// instead of eagerly, keeping them out of the critical path.
let renderMarkdown:
  | ((text: string, mentions?: MentionEntry[]) => string)
  | null = null;
let loadPromise: Promise<void> | null = null;

function loadMarkdownPipeline(): Promise<void> {
  if (renderMarkdown) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = Promise.all([import("marked"), import("dompurify")]).then(
    ([{ marked }, { default: DOMPurify }]) => {
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
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${
          text || href
        }</a>`;
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
            "a",
            "b",
            "i",
            "em",
            "strong",
            "code",
            "pre",
            "br",
            "p",
            "ul",
            "ol",
            "li",
            "blockquote",
            "del",
            "s",
            "span",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hr",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
          ],
          ALLOWED_ATTR: ["href", "target", "rel", "class", "data-join-code"],
          ALLOW_DATA_ATTR: false,
        });
      };
    }
  );
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

/** Max collapsed height in px. Messages taller than this get a "Show more" button. */
const COLLAPSE_HEIGHT = 300;

export function FormattedMessage({
  children,
  mentions,
  className,
}: {
  children: string;
  mentions?: MentionEntry[];
  className?: string;
}) {
  const [ready, setReady] = useState(!!renderMarkdown);

  useEffect(() => {
    if (!renderMarkdown) {
      loadMarkdownPipeline().then(() => setReady(true));
    }
  }, []);

  const html = useMemo(() => {
    if (!renderMarkdown) return "";
    try {
      return replaceEmojisInHtml(renderMarkdown(children, mentions));
    } catch {
      return renderMarkdown(children, mentions);
    }
  }, [children, mentions, ready]);

  // Delegated error handler for animated emoji <img> tags that 404.
  // Replaces the broken img with its alt text (the original emoji) and
  // caches the codepoint so future renders skip the CDN request.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== "IMG" || !img.dataset.cp) return;
      markEmojiCodepointFailed(img.dataset.cp);
      const text = document.createTextNode(img.alt);
      img.replaceWith(text);
    };
    const onLoad = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== "IMG" || !img.dataset.cp) return;
      img.style.opacity = "1";
    };
    el.addEventListener("error", onError, true); // capture phase for img errors
    el.addEventListener("load", onLoad, true); // capture phase for img load
    // Reveal already-cached images that loaded before the listener attached
    el.querySelectorAll<HTMLImageElement>("img[data-cp]").forEach((img) => {
      if (img.complete && img.naturalWidth > 0) img.style.opacity = "1";
    });
    return () => {
      el.removeEventListener("error", onError, true);
      el.removeEventListener("load", onLoad, true);
    };
  }, [html]);

  // ── Expand / collapse for long messages ──
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset expanded state when message content changes
  useEffect(() => {
    setExpanded(false);
  }, [html]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // scrollHeight returns full content height even when maxHeight/overflow:hidden is applied
    setIsOverflowing(el.scrollHeight > COLLAPSE_HEIGHT);
  }, [html]);

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

  const baseClass = `${
    className ?? "text-md"
  } break-words formatted-message inline`;

  // Before markdown loads, show plain text (no flash — loads in ~50ms)
  if (!ready) {
    return <div className={baseClass}>{children}</div>;
  }

  const collapsed = isOverflowing && !expanded;

  return (
    <div>
      <div className={collapsed ? "relative" : undefined}>
        <div
          ref={containerRef}
          className={baseClass}
          style={
            collapsed
              ? {
                  maxHeight: COLLAPSE_HEIGHT,
                  overflow: "hidden",
                  display: "block",
                }
              : undefined
          }
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={handleClick}
        />
        {collapsed && (
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))",
            }}
          />
        )}
      </div>
      {isOverflowing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[12px] text-[#34F080] mt-1 cursor-pointer hover:text-[#34F080]/80 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
