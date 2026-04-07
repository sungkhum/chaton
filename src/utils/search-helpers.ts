import { ProfileEntryResponse } from "deso-protocol";

export const shortenLongWord = (
  key: string | null | undefined,
  endFirstPartAfter = 6,
  startSecondPartAfter = 6,
  separator = "..."
) => {
  if (
    !key ||
    key.length <= endFirstPartAfter + startSecondPartAfter + separator.length
  ) {
    return key || "";
  }

  return [
    key.slice(0, endFirstPartAfter),
    separator,
    key.slice(-startSecondPartAfter),
  ].join("");
};

export const nameOrFormattedKey = (
  profile: ProfileEntryResponse | null,
  key: string
) => {
  return profile?.Username || shortenLongWord(key, 6, 6);
};

export interface SearchMenuItem {
  id: string;
  profile: ProfileEntryResponse | null;
  text: string;
}
