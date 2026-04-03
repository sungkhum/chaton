import { identity } from "deso-protocol";
import { Heart, RefreshCw, Search, Users, X } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EnrichedCommunityListing,
  enrichCommunityListings,
  fetchCommunityListings,
} from "../services/community.service";
import { containsProfanity } from "../utils/profanity-filter";
import { buildInviteUrl } from "../utils/invite-link";
import { useStore } from "../store";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";

const CACHE_KEY = "chaton:community-cache";
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedListings(): EnrichedCommunityListing[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
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
      JSON.stringify({ listings, timestamp: Date.now() })
    );
  } catch {}
}

const CommunityPage = () => {
  usePageMeta({
    title: "Discover Communities — ChatOn",
    description:
      "Browse and join public group chats on the DeSo blockchain. Encrypted, decentralized, and free.",
    path: "/community",
  });

  const appUser = useStore((s) => s.appUser);
  const [listings, setListings] = useState<EnrichedCommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const loadingRef = useRef(false);

  const loadListings = useCallback(async (useCache = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

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
      const raw = await fetchCommunityListings();
      if (cancelled) return;

      const clean = raw.filter(
        (l) => !containsProfanity(l.groupKeyName) && !containsProfanity(l.description)
      );

      if (clean.length === 0) {
        setListings([]);
        setCachedListings([]);
        return;
      }

      const enriched = await enrichCommunityListings(clean);
      if (cancelled) return;

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

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    loadListings().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [loadListings]);

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

  const totalMembers = useMemo(
    () => listings.reduce((sum, l) => sum + l.memberCount, 0),
    [listings]
  );

  const handleLogin = () => {
    identity.login().catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-x-clip">
      {/* Atmospheric Orbs */}
      <div className="landing-orb w-[900px] h-[900px] bg-[#34F080] -top-[300px] -left-[300px] opacity-[0.06]" />
      <div className="landing-orb w-[700px] h-[700px] bg-[#20E0AA] top-[40%] -right-[200px] opacity-[0.04]" />
      <div className="landing-orb w-[800px] h-[800px] bg-[#40B8E0] bottom-[10%] left-[10%] opacity-[0.03]" />

      {/* Navigation — matches landing page pattern */}
      <nav className="fixed top-0 w-full z-50 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-12 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 md:gap-4">
            <a href="/" className="flex items-center gap-2.5 md:gap-4">
              <img
                src="/ChatOn-Logo-Small.png"
                alt="ChatOn"
                className="w-8 h-8 md:w-10 md:h-10 rounded-xl"
              />
              <span className="text-xl md:text-2xl font-black tracking-tighter">ChatOn</span>
            </a>
          </div>

          <div className="hidden md:flex items-center gap-12 text-xs font-bold tracking-[0.2em] uppercase text-gray-400">
            <a href="/#features" className="hover:text-[#34F080] transition-colors">Features</a>
            <span className="text-[#34F080] border-b-2 border-[#34F080] pb-0.5">Community</span>
            <a href="/support" className="hover:text-[#34F080] transition-colors flex items-center gap-1.5">
              <Heart className="w-3 h-3" />
              Donate
            </a>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {appUser ? (
              <a
                href="/"
                className="px-3 md:px-5 py-2 md:py-2.5 text-gray-400 hover:text-white text-[11px] md:text-xs font-bold md:font-black tracking-wide transition-colors"
              >
                Back to Chats
              </a>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="px-3 md:px-5 py-2 md:py-2.5 text-gray-400 hover:text-white text-[11px] md:text-xs font-bold md:font-black tracking-wide transition-colors cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={handleLogin}
                  className="px-4 md:px-6 py-2 md:py-2.5 landing-btn-vivid text-white text-[11px] md:text-xs font-black rounded-full transition-all cursor-pointer"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-28 md:pt-36 pb-6 md:pb-10 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 px-4 md:px-6 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6 md:mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34F080] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34F080]" />
            </span>
            Open Communities
          </div>
          <h1 className="text-3xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight landing-text-logo-gradient mb-5 md:mb-8">
            Discover Communities
          </h1>
          <p className="text-base md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-medium mb-8 md:mb-12">
            Browse and join public group chats on the DeSo blockchain.
            Encrypted, decentralized, and free.
          </p>

          {/* Search bar — glass style */}
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search communities..."
              aria-label="Search communities"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl py-3.5 md:py-4 pl-12 pr-10 text-sm md:text-base text-white placeholder:text-gray-500 bg-white/5 border border-white/10 hover:border-[#34F080]/30 focus:border-[#34F080]/50 outline-none transition-all backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Stats line */}
      {!loading && !error && listings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-12 pb-4 md:pb-6">
          <p className="text-xs md:text-sm text-gray-500 font-medium">
            {listings.length} {listings.length === 1 ? "community" : "communities"} · {totalMembers} total members
          </p>
        </div>
      )}

      {/* Content */}
      <section className="relative px-4 md:px-6 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto">
          {/* Loading state — skeleton grid */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="landing-glass-card rounded-2xl md:rounded-3xl p-5 md:p-6 animate-pulse"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-white/5 rounded w-2/3" />
                      <div className="h-3 bg-white/5 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-5">
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-3/4" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-white/5 rounded w-1/3" />
                    <div className="h-8 bg-white/5 rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <p className="text-gray-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => loadListings(false)}
                className="flex items-center gap-2 px-6 py-3 landing-glass-card rounded-xl text-[#34F080] text-sm font-bold hover:border-[#34F080]/25 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredListings.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-20 md:py-28 text-center">
              <div className="landing-glass-card rounded-3xl p-10 md:p-14 max-w-md">
                <div className="w-20 h-20 rounded-full bg-[#34F080]/10 flex items-center justify-center mx-auto mb-6">
                  <Users className="w-10 h-10 text-[#34F080]" />
                </div>
                <h2 className="text-white font-black text-xl md:text-2xl mb-3">
                  {searchQuery ? "No matches" : "No communities yet"}
                </h2>
                <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                  {searchQuery
                    ? "Try a different search term"
                    : "Group owners can list their chats here for others to discover and join"}
                </p>
              </div>
            </div>
          )}

          {/* Community cards grid */}
          {!loading && !error && filteredListings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredListings.map((listing) => {
                const ownerUsername = listing.ownerProfile?.Username;
                const displayName = listing.groupDisplayName ?? listing.groupKeyName.replace(/\0/g, "");

                return (
                  <a
                    key={listing.associationId}
                    href={listing.inviteCode ? buildInviteUrl(listing.inviteCode) : undefined}
                    className="landing-glass-card rounded-2xl md:rounded-3xl p-5 md:p-6 block group cursor-pointer"
                  >
                    {/* Header: Avatar + Name */}
                    <div className="flex items-center gap-3.5 mb-3">
                      <MessagingDisplayAvatar
                        publicKey={listing.groupKeyName}
                        groupChat
                        groupImageUrl={listing.groupImageUrl}
                        diameter={56}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-white truncate group-hover:text-[#34F080] transition-colors">
                          {displayName}
                        </h3>
                        {ownerUsername && (
                          <p className="text-xs text-gray-500 truncate">by @{ownerUsername}</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {listing.description && (
                      <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-2">
                        {listing.description}
                      </p>
                    )}
                    {!listing.description && <div className="mb-4" />}

                    {/* Footer: Members + Join */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {listing.memberCountCapped ? "50+" : listing.memberCount}{" "}
                          {listing.memberCount === 1 ? "member" : "members"}
                        </span>
                      </div>
                      <span className="px-4 py-1.5 bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black text-xs font-black rounded-full opacity-80 group-hover:opacity-100 transition-opacity">
                        Join
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <img src="/ChatOn-Logo-Small.png" alt="" className="w-5 h-5 rounded-md opacity-50" />
            <span>ChatOn — Messaging that no one can shut down</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
            <a href="/support" className="hover:text-gray-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CommunityPage;
