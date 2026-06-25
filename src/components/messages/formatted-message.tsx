import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { getSingleProfile } from "deso-protocol";

import { MentionEntry } from "../../utils/extra-data";
import { useStore } from "../../store";
import {
  replaceEmojisInHtml,
  markEmojiCodepointFailed,
} from "./animated-emoji";

// Match internal join links: getchaton.com/join/<code> or localhost:*/join/<code>
const JOIN_LINK_RE =
  /^https?:\/\/(?:(?:www\.)?getchaton\.com|localhost:\d+)\/join\/([A-Za-z0-9]+)$/;

// Match @handles in raw message text. Mirrors the lookbehind/lookahead guards in
// highlightMentions so emails (foo@bar) and URL paths (/@handle) are left alone.
const MENTION_SCAN_RE = /(?<![\w/])@([A-Za-z0-9_]{1,30})(?!\w)/g;

// Cap profile lookups per message so a spammy message packed with unique @handles
// can't fan out into an unbounded burst of getSingleProfile requests.
const MAX_MENTION_LOOKUPS = 12;

// Resolve each @handle to a public key once per session: value = pk, or null
// when no DeSo profile exists for that handle.
const mentionPkCache = new Map<string, string | null>();
const mentionPkPending = new Map<string, Promise<string | null>>();

/** Look up the DeSo public key for an @handle, caching the result. */
function resolveMentionPk(username: string): Promise<string | null> {
  const key = username.toLowerCase();
  const cached = mentionPkCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = mentionPkPending.get(key);
  if (inflight) return inflight;
  const promise = getSingleProfile({
    Username: username,
    NoErrorOnMissing: true,
  })
    .then((res) => {
      const pk = res?.Profile?.PublicKeyBase58Check ?? null;
      mentionPkCache.set(key, pk);
      return pk;
    })
    .catch(() => {
      // Don't cache transient network/server failures — a real user shouldn't be
      // permanently treated as "no profile" for the rest of the session over one
      // failed lookup. Returning null uncached lets a later render retry.
      return null;
    })
    .finally(() => {
      mentionPkPending.delete(key);
    });
  mentionPkPending.set(key, promise);
  return promise;
}

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
          ALLOWED_ATTR: [
            "href",
            "target",
            "rel",
            "class",
            "data-join-code",
            "data-user-pk",
            "data-user-un",
            "role",
            "tabindex",
          ],
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

/** Escape double-quotes for safe embedding in an HTML attribute. */
function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function highlightMentions(html: string, mentions: MentionEntry[]): string {
  if (mentions.length === 0) return html;
  for (const m of mentions) {
    const pattern = new RegExp(`(?<![\\w/])@${escapeRegex(m.un)}(?!\\w)`, "g");
    const pkAttr = escapeAttr(m.pk);
    const unAttr = escapeAttr(m.un);
    html = html.replace(
      pattern,
      `<span class="mention-highlight" role="button" tabindex="0" data-user-pk="${pkAttr}" data-user-un="${unAttr}">@${m.un}</span>`
    );
  }
  return html;
}

/** Max collapsed height in px. Messages taller than this get a "Show more" button. */
const COLLAPSE_HEIGHT = 280;

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

  // Highlighting is driven purely by send-time metadata, which only captures
  // users picked from the mention dropdown (group members). Handles typed for
  // anyone else — e.g. a DeSo user who isn't in this group — never make it into
  // the metadata, so they render as plain text. Resolve those un-tagged @handles
  // against DeSo here so any real user gets the same pill as picked members.
  const [resolvedMentions, setResolvedMentions] = useState<MentionEntry[]>([]);

  useEffect(() => {
    if (!children.includes("@")) {
      setResolvedMentions((prev) => (prev.length ? [] : prev));
      return;
    }
    const known = new Set(
      (stableMentions ?? []).map((m) => m.un.toLowerCase())
    );
    const handles: string[] = [];
    const seen = new Set<string>();
    for (const match of children.matchAll(MENTION_SCAN_RE)) {
      const un = match[1];
      if (!un) continue;
      const key = un.toLowerCase();
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      handles.push(un);
      if (handles.length >= MAX_MENTION_LOOKUPS) break;
    }
    if (handles.length === 0) {
      setResolvedMentions((prev) => (prev.length ? [] : prev));
      return;
    }
    let cancelled = false;
    Promise.all(
      handles.map(async (un) => {
        const pk = await resolveMentionPk(un);
        return pk ? { pk, un } : null;
      })
    ).then((entries) => {
      if (cancelled) return;
      const found = entries.filter((e): e is MentionEntry => e !== null);
      setResolvedMentions((prev) =>
        found.length === 0 && prev.length === 0 ? prev : found
      );
    });
    return () => {
      cancelled = true;
    };
  }, [children, stableMentions]);

  const mergedMentions = useMemo(() => {
    if (resolvedMentions.length === 0) return stableMentions;
    return [...(stableMentions ?? []), ...resolvedMentions];
  }, [stableMentions, resolvedMentions]);

  const html = useMemo(() => {
    if (!renderMarkdown) return "";
    try {
      return replaceEmojisInHtml(renderMarkdown(children, mergedMentions));
    } catch {
      return renderMarkdown(children, mergedMentions);
    }
  }, [children, mergedMentions, ready]);

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
  const measureRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset expanded state when message content changes
  useEffect(() => {
    setExpanded(false);
  }, [html]);

  useLayoutEffect(() => {
    // Measure the block-level wrapper, not the inline content div — scrollHeight
    // on inline elements returns 0 in WebKit, which silently disables collapse.
    const el = measureRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > COLLAPSE_HEIGHT);
  }, [html]);

  // Intercept clicks on internal join links — open as in-app modal.
  // Also intercept clicks on @mention spans to open the user action menu.
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest<HTMLAnchorElement>("a[data-join-code]");
    if (anchor) {
      e.preventDefault();
      const code = anchor.dataset.joinCode;
      if (code) {
        useStore.getState().setPendingJoinCode(code);
      }
      return;
    }
    const mention = target.closest<HTMLElement>("[data-user-pk]");
    if (mention) {
      e.preventDefault();
      e.stopPropagation();
      const pk = mention.dataset.userPk;
      const un = mention.dataset.userUn;
      if (pk) {
        const rect = mention.getBoundingClientRect();
        useStore.getState().openUserActionMenu(
          pk,
          {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          },
          un || undefined
        );
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
      <div ref={measureRef} className={collapsed ? "relative" : undefined}>
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
          className="text-[12px] text-brand mt-1 cursor-pointer hover:text-brand/80 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
