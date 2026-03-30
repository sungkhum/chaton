import {
  getProfiles,
  getSingleProfile,
  identity,
  ProfileEntryResponse,
} from "deso-protocol";
import { Loader2 } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import {
  isMaybeDeSoPublicKey,
  isMaybeENSName,
  isMaybeETHAddress,
} from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { MyErrorLabel } from "./form/my-error-label";

export const shortenLongWord = (
  key: string | null,
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

interface SearchUsersProps {
  placeholder?: string;
  hasPersistentDisplayValue?: boolean;
  initialValue?: string;
  onSelected: (item: SearchMenuItem | null) => void;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onTyping?: any;
  onChange?: (value: string) => void;
  /** Increment to programmatically clear the input (resets internal state). */
  clearTrigger?: number;
  /** When set, user search results go to this callback instead of showing a dropdown overlay. */
  onUserResults?: (items: SearchMenuItem[]) => void;
  className?: string;
}

export const SearchUsers = ({
  placeholder = "Search for users",
  hasPersistentDisplayValue = false,
  initialValue = "",
  onSelected,
  error,
  onFocus,
  onBlur,
  onTyping,
  onChange,
  clearTrigger,
  onUserResults,
  className = "",
}: SearchUsersProps) => {
  const [menuItems, setMenuItems] = useState<SearchMenuItem[]>();
  const [inputValue, setInputValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { appUser } = useStore();

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  // Allow parent to programmatically clear the input
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setInputValue("");
      setMenuItems([]);
      setIsOpen(false);
      onUserResults?.([]);
    }
  }, [clearTrigger]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchForPublicKey = async (publicKey: string): Promise<SearchMenuItem> => {
    const res = await getSingleProfile({
      PublicKeyBase58Check: publicKey,
      NoErrorOnMissing: true,
    });

    const item = {
      id: publicKey,
      profile: res?.Profile,
      text: nameOrFormattedKey(res?.Profile, publicKey),
    };
    await onSelected(item);
    setInputValue("");
    setMenuItems([]);
    setIsOpen(false);
    onUserResults?.([]);
    return item;
  };

  const _getProfiles = async (query: string) => {
    try {
      if (isMaybeENSName(query) || isMaybeETHAddress(query)) {
        let address = query;
        if (isMaybeENSName(query)) {
          // ENS resolution disabled for now
          return;
        }
        const desoPublicKey = await identity.ethereumAddressToDesoAddress(address);
        await searchForPublicKey(desoPublicKey);
        return;
      } else if (isMaybeDeSoPublicKey(query)) {
        await searchForPublicKey(query);
        return;
      }
    } catch (e: any) {
      if (
        e?.message
          ?.toString()
          .startsWith("GetSingleProfile: could not find profile for username or public key")
      ) {
        return;
      }
    }

    const res = await getProfiles({
      PublicKeyBase58Check: "",
      Username: "",
      UsernamePrefix: query,
      Description: "",
      OrderBy: "",
      NumToFetch: 7,
      ReaderPublicKeyBase58Check: appUser?.PublicKeyBase58Check ?? "",
      ModerationType: "",
      FetchUsersThatHODL: false,
      AddGlobalFeedBool: false,
    });

    const items = (res.ProfilesFound || []).map((p) => ({
      id: p.PublicKeyBase58Check,
      profile: p,
      text: nameOrFormattedKey(p, p.PublicKeyBase58Check),
    }));
    if (onUserResults) {
      onUserResults(items);
    } else {
      setMenuItems(items);
      if (items.length > 0) setIsOpen(true);
    }
  };

  const getProfilesDebounced = (q: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      await _getProfiles(q)
        .catch((e) => {
          console.error(e);
          toast.error(e);
        })
        .finally(() => setLoading(false));
    }, 500);
  };

  const shownItems = menuItems || [];

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          spellCheck={false}
          className={`w-full rounded-md py-2 px-3 ${className} text-blue-100 bg-blue-900/20 ${
            error
              ? "border border-red-500"
              : "border border-transparent focus:border-blue-600"
          } outline-none`}
          value={inputValue}
          onChange={async (ev) => {
            const name = ev.target.value.trim();
            setInputValue(ev.target.value);
            onChange?.(ev.target.value);

            if (!name) {
              setMenuItems([]);
              setIsOpen(false);
              onUserResults?.([]);
              return;
            }

            if (onTyping) {
              onTyping(name, (items: Array<SearchMenuItem>) => {
                setMenuItems(items);
                if (items.length > 0) setIsOpen(true);
              });
              return;
            }
            getProfilesDebounced(name);
          }}
          onFocus={() => {
            if (shownItems.length > 0) setIsOpen(true);
            onFocus?.();
          }}
          onBlur={onBlur}
        />
        <MyErrorLabel error={error} />
      </div>

      {!onUserResults && isOpen && (loading || shownItems.length > 0) && (
        <div className="absolute z-10 w-full bg-[#050e1d] text-blue-100 max-h-80 mt-1 rounded-md overflow-y-scroll custom-scrollbar border border-blue-900">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            </div>
          )}
          {!loading &&
            shownItems.map(({ id, profile, text }) => (
              <div
                key={id}
                className="bg-[#050e1d] text-blue-100 hover:bg-blue-800 cursor-pointer"
                onClick={() => {
                  if (hasPersistentDisplayValue) {
                    setInputValue(id);
                  } else {
                    setInputValue("");
                  }
                  const menuItem = shownItems.find((item) => item.id === id);
                  if (menuItem) onSelected(menuItem);
                  setIsOpen(false);
                  setMenuItems([]);
                }}
              >
                <div className="flex p-2 items-center">
                  {profile && (
                    <MessagingDisplayAvatar
                      publicKey={profile.PublicKeyBase58Check}
                      diameter={50}
                      classNames="mx-0"
                    />
                  )}
                  <span className="ml-4">{text}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
