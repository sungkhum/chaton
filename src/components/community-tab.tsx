import { RefreshCw, Search, Users, X } from "lucide-react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EnrichedCommunityListing,
  enrichCommunityListings,
  fetchCommunityListings,
} from "../services/community.service";
import { containsProfanity } from "../utils/profanity-filter";
import { buildInviteUrl } from "../utils/invite-link";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { useStore } from "../store";

const CACHE_KEY = "chaton:community-cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  listings: EnrichedCommunityListing[];
  timestamp: number;
}

function getCachedListings(): EnrichedCommunityListing[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.listings;
  } catch {
    return null;
  }
}

function setCachedListings(listings: EnrichedCommunityListing[]) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ listings, timestamp: Date.now() } satisfies CachedData)
    );
  } catch {
    // sessionStorage full or unavailable
  }
}

/**
 * Reusable community listings component. Used by both the sidebar tab
 * and the public /community page.
 */
export const CommunityTab: FC<{
  /** When true, uses full-page styling instead of sidebar styling */
  fullPage?: boolean;
  /** Called when clicking a group the user is already a member of */
  onSelectConversation?: (conversationKey: string) => void;
}> = ({ fullPage = false, onSelectConversation }) => {
  const allAccessGroups = useStore((s) => s.allAccessGroups);
  const [listings, setListings] = useState<EnrichedCommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const loadingRef = useRef(false);

  const memberGroupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const g of allAccessGroups) {
      keys.add(
        g.AccessGroupOwnerPublicKeyBase58Check + "|" + g.AccessGroupKeyName
      );
    }
    return keys;
  }, [allAccessGroups]);

  const loadListings = useCallback(async (useCache = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    // Check cache first
    if (useCache) {
      const cached = getCachedListings();
      if (cached) {
        setListings(cached);
        setLoading(false);
        loadingRef.current = false;
        return;
      }
    }

    let cancelled = false;

    try {
      // Phase 1: Fetch raw listings (names + profiles + descriptions)
      const raw = await fetchCommunityListings();
      if (cancelled) return;

      // Filter profanity on display — check both group name and description
      const clean = raw.filter(
        (l) =>
          !containsProfanity(l.groupKeyName) &&
          !containsProfanity(l.description)
      );

      if (clean.length === 0) {
        setListings([]);
        setCachedListings([]);
        return;
      }

      // Phase 2+3: Enrich with images, invite codes, member counts
      const enriched = await enrichCommunityListings(clean);
      if (cancelled) return;

      // Post-enrichment profanity check on display names (owners can rename groups)
      const safeEnriched = enriched.filter(
        (l) => !l.groupDisplayName || !containsProfanity(l.groupDisplayName)
      );

      setListings(safeEnriched);
      setCachedListings(safeEnriched);
    } catch (err) {
      if (cancelled) return;
      console.error("Failed to load community listings:", err);
      setError("Could not load communities");
    } finally {
      if (!cancelled) setLoading(false);
      loadingRef.current = false;
    }

    // Return cleanup function for cancellation
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    loadListings().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [loadListings]);

  // Client-side search filtering
  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => {
      const name = (l.groupDisplayName ?? l.groupKeyName).toLowerCase();
      const owner = (l.ownerProfile?.Username ?? "").toLowerCase();
      const desc = l.description.toLowerCase();
      return name.includes(q) || owner.includes(q) || desc.includes(q);
    });
  }, [listings, searchQuery]);

  const handleCardClick = (
    listing: EnrichedCommunityListing,
    isMember: boolean
  ) => {
    if (isMember && onSelectConversation) {
      onSelectConversation(listing.ownerKey + listing.groupKeyName);
    } else if (listing.inviteCode) {
      window.location.href = buildInviteUrl(listing.inviteCode);
    }
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent,
    listing: EnrichedCommunityListing,
    isMember: boolean
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(listing, isMember);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className={fullPage ? "px-4 sm:px-6 pt-4 pb-3" : "px-4 pt-2 pb-3"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search communities..."
            aria-label="Search communities"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 bg-white/5 border border-white/8 hover:border-[#34F080]/30 focus:border-[#34F080]/50 outline-none transition-colors ${
              fullPage ? "sm:max-w-md" : ""
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={`flex-1 overflow-y-auto custom-scrollbar ${
          fullPage ? "pb-8" : "pb-24"
        }`}
      >
        {/* Loading state */}
        {loading && (
          <div className="px-4 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-3 animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
            <p className="text-gray-400 text-sm mb-3">{error}</p>
            <button
              onClick={() => loadListings(false)}
              className="flex items-center gap-1.5 text-[#34F080] text-sm font-medium hover:brightness-110 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredListings.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#34F080]/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-[#34F080]" />
            </div>
            <h3 className="text-white font-semibold text-base mb-1.5">
              {searchQuery ? "No matches" : "No communities yet"}
            </h3>
            <p className="text-gray-500 text-sm max-w-[280px]">
              {searchQuery
                ? "Try a different search term"
                : "Group owners can list their chats here for others to discover and join"}
            </p>
          </div>
        )}

        {/* Listings */}
        {!loading &&
          !error &&
          filteredListings.map((listing) => {
            const ownerUsername = listing.ownerProfile?.Username;
            const isMember = memberGroupKeys.has(
              listing.ownerKey + "|" + listing.groupKeyName
            );
            return (
              <div key={listing.associationId}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => handleCardClick(listing, isMember)}
                  onKeyDown={(e) => handleCardKeyDown(e, listing, isMember)}
                  className="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer focus-visible:bg-white/5 outline-none"
                >
                  <div className="flex items-center gap-3">
                    <MessagingDisplayAvatar
                      publicKey={listing.groupKeyName}
                      groupChat
                      groupImageUrl={listing.groupImageUrl}
                      diameter={48}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <span className="truncate text-sm text-white font-medium block">
                        {listing.groupDisplayName ?? listing.groupKeyName}
                      </span>
                      {listing.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {listing.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ownerUsername ? `@${ownerUsername}` : ""}
                        {ownerUsername && " · "}
                        {listing.memberCount}
                        {listing.memberCountCapped ? "+" : ""}{" "}
                        {listing.memberCount === 1 && !listing.memberCountCapped
                          ? "member"
                          : "members"}
                      </p>
                    </div>
                    {!isMember && (
                      <span className="text-[#34F080] text-xs font-bold shrink-0 self-center">
                        Join
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-[76px] border-b border-white/5" />
              </div>
            );
          })}
      </div>
    </div>
  );
};
