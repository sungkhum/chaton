import { shortenLongWord } from "./search-helpers";
import { AppUser } from "../store";
import { AccessGroupEntryResponse, ChatType, User } from "deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  PUBLIC_KEY_LENGTH,
  PUBLIC_KEY_PREFIX,
} from "./constants";
import { getGroupDisplayName } from "./extra-data";
import { Conversation } from "./types";

export const copyTextToClipboard = async (text: string) => {
  return navigator.clipboard.writeText(text);
};

export const getProfileURL = (username: string | undefined): string => {
  return username ? `${import.meta.env.VITE_PROFILE_URL}/${username}` : "";
};

export const desoNanosToDeso = (nanos: number | string | bigint) => {
  return Number(nanos) / 1e9;
};

/** Format DESO nanos as a human-readable DESO string (e.g., "0.10 DESO"). */
export const formatDesoAmount = (nanos: number): string => {
  const deso = nanos / 1e9;
  // Use up to 4 decimal places, but trim trailing zeros
  const formatted = deso.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `${formatted} DESO`;
};

export const scrollContainerToElement = (
  cointainerSelector: string,
  elementSelector: string
) => {
  setTimeout(() => {
    const container = document.querySelector(cointainerSelector);
    const element = document.querySelector(elementSelector);

    if (container && element && element instanceof HTMLElement) {
      container.scrollTo(0, element.offsetTop);
    }
  }, 0);
};

export const getChatNameFromConversation = (
  conversation: Conversation,
  getUsernameByPublicKeyBase58Check: { [key: string]: string },
  allAccessGroups?: AccessGroupEntryResponse[]
): string | undefined => {
  if (conversation.ChatType === ChatType.DM) {
    return getUsernameByPublicKeyBase58Check[
      conversation.firstMessagePublicKey
    ];
  }
  const firstMsg = conversation.messages[0];
  if (!firstMsg) return undefined;
  const recipientInfo = firstMsg.RecipientInfo;
  if (allAccessGroups) {
    const displayName = getGroupDisplayName(
      allAccessGroups,
      recipientInfo.OwnerPublicKeyBase58Check,
      recipientInfo.AccessGroupKeyName
    );
    if (displayName) return displayName;
  }
  return recipientInfo.AccessGroupKeyName.replace(/\0/g, "");
};

export const isMaybeDeSoPublicKey = (query: string): boolean => {
  return (
    query.length === PUBLIC_KEY_LENGTH && query.startsWith(PUBLIC_KEY_PREFIX)
  );
};

export const isMaybeETHAddress = (query: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/g.test(query);
};

export const isMaybeENSName = (query: string): boolean => {
  return /(\.eth)$/g.test(query);
};

export const formatDisplayName = (user: User, prefix = "@") => {
  const maybeUserName = user?.ProfileEntryResponse?.Username;

  return maybeUserName
    ? `${prefix}${maybeUserName}`
    : shortenLongWord(user?.PublicKeyBase58Check);
};

export const hasSetupMessaging = (user: AppUser | null) => {
  return !!user?.accessGroupsOwned?.find(
    ({ AccessGroupKeyName }) =>
      AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME
  );
};

export const formatRelativeTimestamp = (tstampNanos: number): string => {
  const date = new Date(tstampNanos / 1e6);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  if (date.getFullYear() !== now.getFullYear()) {
    return `${month} ${day}, ${date.getFullYear()}`;
  }
  return `${month} ${day}`;
};

/** Format an ISO timestamp into a human-readable "last seen" string. */
export const formatLastSeen = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "active just now";
  if (diffMins < 60) return `active ${diffMins}m ago`;
  if (diffHours < 24) return `active ${diffHours}h ago`;

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `active ${diffDays}d ago`;

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `active ${month} ${day}`;
};
