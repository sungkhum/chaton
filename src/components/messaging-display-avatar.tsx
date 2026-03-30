import { buildProfilePictureUrl } from "deso-protocol";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { AVATAR_COLORS, hashToColorIndex, getInitials } from "../utils/avatar";
import { getProfileURL } from "../utils/helpers";

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
      className={`w-full ${className}`}
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
}> = ({
  publicKey,
  username,
  diameter,
  borderColor = "border-white",
  classNames = "",
  groupChat = false,
  groupImageUrl,
  extraDataPicUrl,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  // Track which URL index we're trying (for fallback chain)
  const [urlIndex, setUrlIndex] = useState(0);

  const colorIndex = useMemo(
    () => hashToColorIndex(publicKey || username || ""),
    [publicKey, username]
  );
  const avatarColor = AVATAR_COLORS[colorIndex];

  // Build ordered list of candidate image URLs
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

  // Reset when candidates change
  useEffect(() => {
    setImgFailed(false);
    setUrlIndex(0);
  }, [candidateUrls]);

  const profilePicUrl = candidateUrls[urlIndex] || "";

  const [imgLoaded, setImgLoaded] = useState(false);
  const showImage = !!profilePicUrl && !imgFailed;
  const initials = getInitials(
    groupChat ? (publicKey || "") : (username || publicKey || "")
  );
  const fontSize = Math.round(diameter * 0.38);

  const handleImgLoad = useCallback(() => setImgLoaded(true), []);
  const handleImgError = useCallback(() => {
    // Try next candidate URL before giving up
    if (urlIndex < candidateUrls.length - 1) {
      setUrlIndex((i) => i + 1);
      setImgLoaded(false);
    } else {
      setImgFailed(true);
    }
  }, [urlIndex, candidateUrls.length]);

  // Reset loaded state when the URL changes
  useEffect(() => {
    setImgLoaded(false);
  }, [profilePicUrl]);

  return (
    <ConditionalLink
      className={`block ${classNames}`}
      style={{
        width: `${diameter}px`,
        maxWidth: `${diameter}px`,
        minWidth: `${diameter}px`,
      }}
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
        className={`rounded-full flex items-center justify-center font-semibold select-none ${borderColor}`}
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
            }}
            className={`bg-no-repeat bg-center bg-cover rounded-full ${borderColor}`}
            alt={publicKey}
            title={publicKey}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        )}
      </div>
    </ConditionalLink>
  );
};
