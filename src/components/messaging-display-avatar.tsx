import { buildProfilePictureUrl } from "deso-protocol";
import { FC, useEffect, useState } from "react";
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

const DEFAULT_PROFILE_PIC_URL = "/assets/default-profile-pic.png";

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 60%, 70%)`;
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

  useEffect(() => {
    let url = "";

    if (!publicKey) {
      setProfilePicUrl(DEFAULT_PROFILE_PIC_URL);
      return;
    }

    if (groupChat) {
      const key = publicKey.replace(/[^a-zA-Z0-9]+/g, "");
      const bgColor = hashToColor(publicKey).replace("#", "");
      url = `https://ui-avatars.com/api/?name=${key}&background=${encodeURIComponent(bgColor)}`;
    } else {
      url = getProfilePicture();
    }

    setProfilePicUrl(url);
  }, [publicKey, groupChat]);

  const getProfilePicture = () => {
    if (!publicKey) return DEFAULT_PROFILE_PIC_URL;
    return buildProfilePictureUrl(publicKey, {
      fallbackImageUrl: `${window.location.href}${DEFAULT_PROFILE_PIC_URL}`,
    });
  };

  if (!profilePicUrl) return <></>;

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
      <img
        src={profilePicUrl}
        style={{ height: `${diameter}px`, width: `${diameter}px` }}
        className={`w-12 h-12 bg-white bg-no-repeat bg-center bg-cover rounded-full ${borderColor}`}
        alt={publicKey}
        title={publicKey}
        onError={() => setProfilePicUrl(DEFAULT_PROFILE_PIC_URL)}
      />
    </ConditionalLink>
  );
};
