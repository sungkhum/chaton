import { buildProfilePictureUrl } from "deso-protocol";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { AVATAR_COLORS, hashToColorIndex, getInitials } from "../utils/avatar";
import { getProfileURL } from "../utils/helpers";

/**
 * Module-level cache of image URLs that have successfully loaded.
 * Hydrated from localStorage on init so avatars display instantly across
 * page refreshes and sessions — no initials→image flash for returning users.
 */
const CACHE_KEY = "chaton:avatar-cache";
const CACHE_MAX = 500;

const loadedUrlCache = new Set<string>(
  (() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })()
);

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistCache() {
  // Debounce: batch rapid image loads into a single localStorage write
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const entries = [...loadedUrlCache];
      const trimmed =
        entries.length > CACHE_MAX ? entries.slice(-CACHE_MAX) : entries;
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch {
      // Storage full or unavailable — cache still works in-memory
    }
  }, 2000);
}

function ConditionalLink({
  children,
  condition,
  href,
  target,
  className,
  style,
  onClick,
}: {
  children: React.ReactElement;
  condition: boolean;
  href: string;
  target: string;
  className: string;
  style: any;
  onClick: (e: any) => void;
}) {
  return condition ? (
    <a
      href={href}
      target={target}
      rel="noreferrer"
      className={className}
      style={style}
      onClick={onClick}
    >
      {children}
    </a>
  ) : (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

export const MessagingDisplayAvatar: FC<{
  publicKey?: string;
  username?: string;
  borderColor?: string;
  diameter: number;
  classNames?: string;
  groupChat?: boolean;
  groupImageUrl?: string;
  /** High-res or NFT profile pic URL from ExtraData (takes priority) */
  extraDataPicUrl?: string;
  /** Show a green online indicator dot */
  showOnlineDot?: boolean;
  /** When true, render as a plain div instead of linking to profile */
  disableLink?: boolean;
}> = ({
  publicKey,
  username,
  diameter,
  borderColor = "border-white",
  classNames = "",
  groupChat = false,
  groupImageUrl,
  extraDataPicUrl,
  showOnlineDot = false,
  disableLink = false,
}) => {
  const colorIndex = useMemo(
    () => hashToColorIndex(publicKey || username || ""),
    [publicKey, username]
  );
  const avatarColor = AVATAR_COLORS[colorIndex];

  // Build ordered list of candidate image URLs (deterministic, no cache busters)
  const candidateUrls = useMemo(() => {
    if (groupChat) return groupImageUrl ? [groupImageUrl] : [];
    if (!publicKey) return [];
    const urls: string[] = [];
    // Priority 1: ExtraData URL (LargeProfilePicURL or NFT pic)
    if (extraDataPicUrl) urls.push(extraDataPicUrl);
    // Priority 2: SDK-built standard endpoint
    const sdkUrl = buildProfilePictureUrl(publicKey, { fallbackImageUrl: "" });
    if (sdkUrl) urls.push(sdkUrl);
    // Priority 3: Direct URL construction (fallback if SDK URL is malformed)
    const directUrl = `${
      import.meta.env.VITE_NODE_URL
    }/api/v0/get-single-profile-picture/${publicKey}`;
    if (!urls.includes(directUrl)) urls.push(directUrl);
    return urls;
  }, [publicKey, groupChat, groupImageUrl, extraDataPicUrl]);

  // Track which URL index we're trying (for fallback chain)
  const [urlIndex, setUrlIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const profilePicUrl = candidateUrls[urlIndex] || "";

  // Start as `true` if the URL is already in our success cache (instant display on remount)
  const [imgLoaded, setImgLoaded] = useState(
    () => !!profilePicUrl && loadedUrlCache.has(profilePicUrl)
  );

  // Track the URL that successfully loaded — protects against stale onError from
  // browser cache revalidation firing AFTER onLoad.
  const loadedUrlRef = useRef<string | null>(imgLoaded ? profilePicUrl : null);

  // Reset fallback state during render when candidate URLs change (conversation
  // switch, new group image, etc). Render-phase reset avoids the useEffect race
  // where onLoad fires for a cached image before the effect can run.
  const candidateKey = candidateUrls.join("|");
  const prevCandidateKeyRef = useRef(candidateKey);
  if (prevCandidateKeyRef.current !== candidateKey) {
    prevCandidateKeyRef.current = candidateKey;
    setImgFailed(false);
    // Find the first cached candidate so we can skip the flash
    const cachedIdx = candidateUrls.findIndex((u) => loadedUrlCache.has(u));
    const bestIdx = cachedIdx >= 0 ? cachedIdx : 0;
    setUrlIndex(bestIdx);
    const bestUrl = candidateUrls[bestIdx] || "";
    setImgLoaded(!!bestUrl && loadedUrlCache.has(bestUrl));
    loadedUrlRef.current = null;
  }

  const showImage = !!profilePicUrl && !imgFailed;
  const initials = getInitials(
    groupChat ? publicKey || "" : username || publicKey || ""
  );
  const fontSize = Math.round(diameter * 0.38);

  // rerender-memo-with-default-value: memoize style objects to avoid new allocations each render
  const sizeStyle = useMemo(
    () => ({
      width: `${diameter}px`,
      maxWidth: `${diameter}px`,
      minWidth: `${diameter}px`,
    }),
    [diameter]
  );

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true);
    const url = candidateUrls[urlIndex];
    if (url) {
      loadedUrlCache.add(url);
      loadedUrlRef.current = url;
      persistCache();
    }
  }, [candidateUrls, urlIndex]);

  const handleImgError = useCallback(() => {
    // If this URL already loaded successfully (browser cache revalidation race),
    // ignore the error — the image is already visible.
    if (loadedUrlRef.current === candidateUrls[urlIndex]) return;

    // Try next candidate URL before giving up
    if (urlIndex < candidateUrls.length - 1) {
      setUrlIndex((i) => i + 1);
      setImgLoaded(false);
    } else {
      setImgFailed(true);
    }
  }, [urlIndex, candidateUrls]);

  return (
    <ConditionalLink
      className={`block shrink-0 ${classNames}`}
      style={sizeStyle}
      href={getProfileURL(username)}
      condition={!!username && !disableLink}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          position: "relative",
          width: `${diameter}px`,
          height: `${diameter}px`,
        }}
      >
        {/* Always render initials as the base layer — zero layout shift */}
        <div
          style={{
            position: "relative",
            height: `${diameter}px`,
            width: `${diameter}px`,
            backgroundColor: avatarColor!.bg,
            fontSize: `${fontSize}px`,
          }}
          className={`rounded-full overflow-hidden flex items-center justify-center font-semibold select-none ${borderColor}`}
        >
          <span style={{ color: avatarColor!.text, lineHeight: 1 }}>
            {initials}
          </span>
          {showImage && (
            <img
              src={profilePicUrl}
              style={{
                height: `${diameter}px`,
                width: `${diameter}px`,
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.2s ease-in",
                position: "absolute",
                inset: 0,
                objectFit: "cover",
              }}
              className={`rounded-full ${borderColor}`}
              alt={username || ""}
              title={username || undefined}
              onLoad={handleImgLoad}
              onError={handleImgError}
            />
          )}
        </div>
        {showOnlineDot && (
          <span
            style={{
              width: `${Math.max(Math.round(diameter * 0.28), 8)}px`,
              height: `${Math.max(Math.round(diameter * 0.28), 8)}px`,
              bottom: "0px",
              right: "0px",
            }}
            className="absolute rounded-full bg-[#34F080] border-2 border-[#0a1019]"
          />
        )}
      </div>
    </ConditionalLink>
  );
};
