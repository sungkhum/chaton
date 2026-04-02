import { buildProfilePictureUrl } from "deso-protocol";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { AVATAR_COLORS, hashToColorIndex, getInitials } from "../utils/avatar";
import { getProfileURL } from "../utils/helpers";

/**
 * Module-level cache of image URLs that have successfully loaded.
 * Survives component remounts — once we know a URL works, skip the
 * opacity-0 loading phase on subsequent mounts.
 */
const loadedUrlCache = new Set<string>();

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
    const directUrl = `${import.meta.env.VITE_NODE_URL}/api/v0/get-single-profile-picture/${publicKey}`;
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
  const loadedUrlRef = useRef<string | null>(
    imgLoaded ? profilePicUrl : null
  );

  const showImage = !!profilePicUrl && !imgFailed;
  const initials = getInitials(
    groupChat ? (publicKey || "") : (username || publicKey || "")
  );
  const fontSize = Math.round(diameter * 0.38);

  // rerender-memo-with-default-value: memoize style objects to avoid new allocations each render
  const sizeStyle = useMemo(() => ({
    width: `${diameter}px`,
    maxWidth: `${diameter}px`,
    minWidth: `${diameter}px`,
  }), [diameter]);

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true);
    // Cache this URL module-wide so future mounts are instant
    const url = candidateUrls[urlIndex];
    if (url) {
      loadedUrlCache.add(url);
      loadedUrlRef.current = url;
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
      condition={!!username}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Always render initials as the base layer — zero layout shift */}
      <div
        style={{
          height: `${diameter}px`,
          width: `${diameter}px`,
          backgroundColor: avatarColor.bg,
          fontSize: `${fontSize}px`,
          position: "relative",
        }}
        className={`rounded-full overflow-hidden flex items-center justify-center font-semibold select-none ${borderColor}`}
        title={publicKey}
      >
        <span style={{ color: avatarColor.text, lineHeight: 1 }}>
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
            alt={publicKey}
            title={publicKey}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        )}
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
