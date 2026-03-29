import { buildProfilePictureUrl } from "deso-protocol";
import { FC, useEffect, useMemo, useState } from "react";
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

// Telegram-inspired vibrant avatar palette, tuned for dark backgrounds
const AVATAR_COLORS = [
  { bg: "#E17076", text: "#FFFFFF" }, // coral red
  { bg: "#FAA74A", text: "#FFFFFF" }, // warm orange
  { bg: "#A695E7", text: "#FFFFFF" }, // soft violet
  { bg: "#7BC862", text: "#FFFFFF" }, // fresh green
  { bg: "#6EC9CB", text: "#FFFFFF" }, // teal cyan
  { bg: "#65AADD", text: "#FFFFFF" }, // sky blue
  { bg: "#EE7AAE", text: "#FFFFFF" }, // rose pink
  { bg: "#E4AE3A", text: "#FFFFFF" }, // golden amber
];

function hashToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

function getInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.substring(0, 2).toUpperCase();
}

export const MessagingDisplayAvatar: FC<{
  publicKey?: string;
  username?: string;
  borderColor?: string;
  diameter: number;
  classNames?: string;
  groupChat?: boolean;
}> = ({
  publicKey,
  username,
  diameter,
  borderColor = "border-white",
  classNames = "",
  groupChat = false,
}) => {
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  const colorIndex = useMemo(
    () => hashToColorIndex(publicKey || username || ""),
    [publicKey, username]
  );
  const avatarColor = AVATAR_COLORS[colorIndex];

  useEffect(() => {
    setImgFailed(false);

    if (!publicKey) {
      setProfilePicUrl("");
      return;
    }

    if (groupChat) {
      // Group chats always use the initials avatar
      setProfilePicUrl("");
    } else {
      setProfilePicUrl(getProfilePicture());
    }
  }, [publicKey, groupChat]);

  const getProfilePicture = () => {
    if (!publicKey) return "";
    return buildProfilePictureUrl(publicKey, {
      fallbackImageUrl: "",
    });
  };

  const showInitials = groupChat || !profilePicUrl || imgFailed;
  const initials = getInitials(
    groupChat ? (publicKey || "") : (username || publicKey || "")
  );
  const fontSize = Math.round(diameter * 0.38);

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
      {showInitials ? (
        <div
          style={{
            height: `${diameter}px`,
            width: `${diameter}px`,
            backgroundColor: avatarColor.bg,
            fontSize: `${fontSize}px`,
          }}
          className={`rounded-full flex items-center justify-center font-semibold select-none ${borderColor}`}
          title={publicKey}
        >
          <span style={{ color: avatarColor.text, lineHeight: 1 }}>
            {initials}
          </span>
        </div>
      ) : (
        <img
          src={profilePicUrl}
          style={{ height: `${diameter}px`, width: `${diameter}px` }}
          className={`bg-no-repeat bg-center bg-cover rounded-full ${borderColor}`}
          alt={publicKey}
          title={publicKey}
          onError={() => setImgFailed(true)}
        />
      )}
    </ConditionalLink>
  );
};
