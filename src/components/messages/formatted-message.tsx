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
// Call preloadMarkdownPipeline() early (e.g. when user logs in) so the
// pipeline is ready before messages render — avoids the ready:false→true
// transition that recreates all inline emoji <img> elements.
let renderMarkdown:
  | ((text: string, mentions?: MentionEntry[]) => string)
  | null = null;
let loadPromise: Promise<void> | null = null;

/** Kick off the markdown pipeline load early so it's ready before messages render. */
export function preloadMarkdownPipeline(): Promise<void> {
  return loadMarkdownPipeline();
}

// Start loading immediately on import — don't wait for the first
// FormattedMessage to mount. This gives the pipeline a head start
// so `ready` starts as `true` by the time messages render.
if (typeof window !== "undefined") loadMarkdownPipeline();

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

  // Stabilize mentions so useMemo only recomputes when content actually
  // changes — not on every render due to a new array reference from
  // JSON.parse in safeParseMentions. Without this, every parent re-render
  // recomputes html, and if the value differs even slightly (e.g. mentions
  // going from undefined → populated), React replaces the innerHTML,
  // destroying all inline emoji <img> elements (restarting animations).
  const mentionsKey = mentions ? mentions.map((m) => m.un).join(",") : "";
  // eslint-disable-next-line -- intentionally using mentionsKey (derived) instead of mentions (unstable ref)
  const stableMentions = useMemo(() => mentions, [mentionsKey]);

  const html = useMemo(() => {
    if (!renderMarkdown) return "";
    try {
      return replaceEmojisInHtml(renderMarkdown(children, stableMentions));
    } catch {
      return renderMarkdown(children, stableMentions);
    }
  }, [children, stableMentions, ready]);

  // Memoize the dangerouslySetInnerHTML prop object so React sees the same
  // reference on re-renders. Without this, `{{ __html: html }}` creates a
  // new object every render, and React replaces the innerHTML even though
  // the html string value is identical — destroying all inline emoji <img>
  // elements and causing the flash-to-black.
  const innerHtmlProp = useMemo(() => ({ __html: html }), [html]);

  // Delegated error/load handlers for inline animated emoji <img> tags.
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
    el.addEventListener("error", onError, true);
    return () => {
      el.removeEventListener("error", onError, true);
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
          dangerouslySetInnerHTML={innerHtmlProp}
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
