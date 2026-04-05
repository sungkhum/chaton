import { ArrowLeft, Loader2, Users } from "lucide-react";
import { FC, useEffect, useRef, useState } from "react";
import { getProfiles, getSingleProfile, identity } from "deso-protocol";
import { toast } from "sonner";
import { useStore } from "../store";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../utils/constants";
import {
  isMaybeDeSoPublicKey,
  isMaybeENSName,
  isMaybeETHAddress,
} from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { nameOrFormattedKey, SearchMenuItem } from "../utils/search-helpers";

interface ComposePanelProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (publicKeyWithGroup: string) => void;
  onNewGroup: () => void;
}

export const ComposePanel: FC<ComposePanelProps> = ({
  open,
  onClose,
  onSelectUser,
  onNewGroup,
}) => {
  const appUser = useStore((s) => s.appUser);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus the search input when the panel opens
  useEffect(() => {
    if (open) {
      // Small delay to allow the slide animation to start
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const searchForPublicKey = async (publicKey: string) => {
    const res = await getSingleProfile({
      PublicKeyBase58Check: publicKey,
      NoErrorOnMissing: true,
    });
    handleSelectUser({
      id: publicKey,
      profile: res?.Profile ?? null,
      text: nameOrFormattedKey(res?.Profile ?? null, publicKey),
    });
  };

  const searchProfiles = async (q: string) => {
    try {
      if (isMaybeENSName(q) || isMaybeETHAddress(q)) {
        const address = q;
        if (isMaybeENSName(q)) return; // ENS resolution disabled
        const desoPublicKey = await identity.ethereumAddressToDesoAddress(
          address
        );
        await searchForPublicKey(desoPublicKey);
        return;
      } else if (isMaybeDeSoPublicKey(q)) {
        await searchForPublicKey(q);
        return;
      }
    } catch (e: any) {
      if (
        e?.message
          ?.toString()
          .startsWith("GetSingleProfile: could not find profile")
      ) {
        return;
      }
    }

    const res = await getProfiles({
      PublicKeyBase58Check: "",
      Username: "",
      UsernamePrefix: q,
      Description: "",
      OrderBy: "",
      NumToFetch: 15,
      ReaderPublicKeyBase58Check: appUser?.PublicKeyBase58Check ?? "",
      ModerationType: "",
      FetchUsersThatHODL: false,
      AddGlobalFeedBool: false,
    });

    setResults(
      (res.ProfilesFound || []).map((p) => ({
        id: p.PublicKeyBase58Check,
        profile: p,
        text: nameOrFormattedKey(p, p.PublicKeyBase58Check),
      }))
    );
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await searchProfiles(trimmed)
        .catch((e) => {
          console.error(e);
          toast.error(String(e));
        })
        .finally(() => setLoading(false));
    }, 400);
  };

  const handleSelectUser = (item: SearchMenuItem) => {
    onSelectUser(item.id + DEFAULT_KEY_MESSAGING_GROUP_NAME);
    onClose();
  };

  return (
    <div
      className={`absolute inset-0 z-30 bg-[#080d16] transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-white/10">
        <button
          onClick={onClose}
          className="p-1.5 -ml-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h2 className="text-white font-semibold text-base">New Message</h2>
      </div>

      {/* Search input */}
      <div className="px-4 py-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for people..."
          spellCheck={false}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full rounded-xl py-2.5 px-3.5 text-white placeholder:text-gray-500 bg-white/5 border border-white/8 hover:border-[#34F080]/30 focus:border-[#34F080]/50 outline-none text-sm transition-colors"
        />
      </div>

      {/* Action rows */}
      {!query.trim() && (
        <div className="px-2">
          <button
            onClick={() => {
              onNewGroup();
              onClose();
            }}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#34F080]/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#34F080]" />
            </div>
            <span className="text-white font-medium text-sm">New Group</span>
          </button>
        </div>
      )}

      {/* Search results */}
      <div
        className="overflow-y-auto custom-scrollbar"
        style={{ maxHeight: "calc(100% - 140px)" }}
      >
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#34F080]" />
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <div className="text-gray-500 text-sm text-center mt-6 px-6">
            No users found
          </div>
        )}

        {!loading &&
          results.map(({ id, profile, text }) => (
            <button
              key={id}
              onClick={() =>
                handleSelectUser({ id, profile: profile ?? null, text })
              }
              className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <MessagingDisplayAvatar
                username={profile?.Username}
                publicKey={id}
                diameter={44}
                classNames="mx-0"
              />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-white text-sm font-medium truncate">
                  {text}
                </span>
                {profile?.Description && (
                  <span className="text-gray-500 text-xs truncate max-w-[200px]">
                    {profile.Description.slice(0, 60)}
                  </span>
                )}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};
