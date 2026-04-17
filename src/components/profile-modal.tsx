import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getFollowersForUser,
  getPostsForUser,
  getSingleProfile,
} from "deso-protocol";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { shortenLongWord } from "../utils/search-helpers";
import { copyTextToClipboard } from "../utils/helpers";

interface ProfileModalProps {
  publicKey: string;
  username?: string;
  /** Existing extra-data profile picture, used instantly while full profile loads */
  extraDataPicUrl?: string;
  isSelf: boolean;
  onClose: () => void;
  onMessage: () => void;
}

interface ProfileData {
  username?: string;
  description?: string;
  publicKey: string;
  extraDataPicUrl?: string;
}

interface SocialStats {
  followers?: number;
  following?: number;
  posts?: number;
  postsCapped?: boolean;
}

const FOCUS_BASE = "https://focus.xyz";
const DESOCIALWORLD_BASE = "https://desocialworld.com/u";
const POSTS_FETCH_CAP = 100;

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

export function ProfileModal({
  publicKey,
  username,
  extraDataPicUrl,
  isSelf,
  onClose,
  onMessage,
}: ProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData>({
    publicKey,
    username,
    extraDataPicUrl,
  });
  const [stats, setStats] = useState<SocialStats>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const focusUrl = useMemo(
    () => (profile.username ? `${FOCUS_BASE}/${profile.username}` : null),
    [profile.username]
  );
  const desoSocialUrl = useMemo(
    () =>
      profile.username ? `${DESOCIALWORLD_BASE}/${profile.username}` : null,
    [profile.username]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const profilePromise = getSingleProfile({
        PublicKeyBase58Check: publicKey,
        NoErrorOnMissing: true,
      })
        .then((res) => {
          if (cancelled) return;
          const p: any = res?.Profile;
          if (!p) return;
          const extraPic: string | undefined =
            p.ExtraData?.LargeProfilePicURL ||
            p.ExtraData?.NFTProfilePictureUrl ||
            undefined;
          setProfile({
            publicKey,
            username: p.Username || username,
            description: p.Description || undefined,
            extraDataPicUrl: extraPic || extraDataPicUrl,
          });
        })
        .catch((err) => console.warn("Failed to fetch profile", err))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      const followersPromise = getFollowersForUser({
        PublicKeyBase58Check: publicKey,
        GetEntriesFollowingUsername: true,
        NumToFetch: 0,
      })
        .then((res) => ({ followers: res?.NumFollowers ?? 0 }))
        .catch(() => ({ followers: undefined }));

      const followingPromise = getFollowersForUser({
        PublicKeyBase58Check: publicKey,
        GetEntriesFollowingUsername: false,
        NumToFetch: 0,
      })
        .then((res) => ({ following: res?.NumFollowers ?? 0 }))
        .catch(() => ({ following: undefined }));

      const postsPromise = getPostsForUser({
        PublicKeyBase58Check: publicKey,
        NumToFetch: POSTS_FETCH_CAP,
      })
        .then((res) => {
          const count = res?.Posts?.length ?? 0;
          return { posts: count, postsCapped: count >= POSTS_FETCH_CAP };
        })
        .catch(() => ({ posts: undefined, postsCapped: false }));

      const socialPromise = Promise.all([
        followersPromise,
        followingPromise,
        postsPromise,
      ])
        .then(([f, fo, p]) => {
          if (cancelled) return;
          setStats({ ...f, ...fo, ...p });
        })
        .finally(() => {
          if (!cancelled) setStatsLoading(false);
        });

      await Promise.all([profilePromise, socialPromise]);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [publicKey, username, extraDataPicUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopyKey = async () => {
    try {
      await copyTextToClipboard(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const shortKey = shortenLongWord(publicKey, 8, 6);
  const handle = profile.username || username;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm modal-backdrop-enter"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[91] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={handle ? `Profile of ${handle}` : "Profile"}
          className="pointer-events-auto relative w-full sm:max-w-[440px] bg-[#070e1b] text-white border-t border-x sm:border border-white/[0.07] rounded-t-3xl sm:rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden max-h-[92vh] flex flex-col modal-card-enter"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient accent bar — always at top */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] z-20 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]"
          />

          {/* Close button — floats over everything */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-colors cursor-pointer backdrop-blur-sm"
          >
            <X className="w-[18px] h-[18px]" />
          </button>

          {/* Scrollable body — avatar lives inside, glow is absolute backdrop */}
          <div className="relative flex-1 overflow-y-auto">
            {/* Radial glow behind the hero — scrolls with content, fades as you scroll */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[220px]"
              style={{
                background:
                  "radial-gradient(140% 100% at 50% 0%, rgba(52,240,128,0.22) 0%, rgba(32,224,170,0.12) 30%, rgba(64,184,224,0.06) 55%, rgba(0,0,0,0) 78%)",
              }}
            />

            <div className="relative px-5 sm:px-6 pt-10 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] sm:pb-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  {/* Blurred conic halo — sits directly behind the avatar */}
                  <div
                    aria-hidden
                    className="absolute inset-0 -m-1.5 rounded-full pointer-events-none"
                    style={{
                      background:
                        "conic-gradient(from 180deg at 50% 50%, rgba(52,240,128,0.6), rgba(32,224,170,0.5), rgba(64,184,224,0.5), rgba(52,240,128,0.6))",
                      filter: "blur(6px)",
                      opacity: 0.55,
                    }}
                  />
                  <MessagingDisplayAvatar
                    publicKey={publicKey}
                    username={handle}
                    diameter={104}
                    extraDataPicUrl={profile.extraDataPicUrl}
                    classNames="relative"
                    disableLink
                  />
                </div>

                {/* Identity */}
                <div className="mt-4 flex flex-col items-center gap-1 min-w-0 w-full">
                  {handle ? (
                    <h2 className="text-[22px] leading-tight font-bold text-white truncate max-w-full">
                      @{handle}
                    </h2>
                  ) : (
                    <h2 className="text-[18px] leading-tight font-bold text-white/80">
                      Unnamed wallet
                    </h2>
                  )}

                  {/* Public key pill */}
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="group inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] transition-colors cursor-pointer"
                    title="Copy public key"
                  >
                    <span className="text-[11.5px] font-mono text-white/60 tabular-nums tracking-tight">
                      {shortKey}
                    </span>
                    {copied ? (
                      <Check className="w-3 h-3 text-[#34F080]" />
                    ) : (
                      <Copy className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bio */}
              {loading && !profile.description ? (
                <div className="mt-5 flex justify-center">
                  <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                </div>
              ) : profile.description ? (
                <p className="mt-5 text-[14px] leading-relaxed text-white/75 text-center whitespace-pre-wrap break-words max-w-[40ch] mx-auto">
                  {profile.description}
                </p>
              ) : (
                <p className="mt-5 text-[13px] text-white/35 text-center italic">
                  No bio yet
                </p>
              )}

              {/* Social stats */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <Stat
                  label="Followers"
                  value={stats.followers}
                  loading={statsLoading}
                />
                <Stat
                  label="Following"
                  value={stats.following}
                  loading={statsLoading}
                />
                <Stat
                  label="Posts"
                  value={stats.posts}
                  suffix={stats.postsCapped ? "+" : undefined}
                  loading={statsLoading}
                />
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-2.5">
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => {
                      onMessage();
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-bold text-black bg-gradient-to-r from-[#34F080] to-[#20E0AA] hover:shadow-[0_0_30px_rgba(52,240,128,0.35)] active:scale-[0.985] transition-all cursor-pointer min-h-[48px]"
                  >
                    <MessageSquare className="w-[18px] h-[18px]" />
                    Send Message
                  </button>
                )}

                {(focusUrl || desoSocialUrl) && (
                  <div className="pt-1">
                    <div className="flex items-center gap-2.5 mb-2.5 px-0.5">
                      <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-white/35">
                        View posts on
                      </span>
                      <span className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {focusUrl && (
                        <ExternalLinkButton href={focusUrl} label="Focus" />
                      )}
                      {desoSocialUrl && (
                        <ExternalLinkButton
                          href={desoSocialUrl}
                          label="DeSocialWorld"
                        />
                      )}
                    </div>
                  </div>
                )}

                {!handle && (
                  <p className="text-[11.5px] text-white/35 text-center pt-1">
                    This wallet has no username yet — social profiles aren't
                    available.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function Stat({
  label,
  value,
  suffix,
  loading,
}: {
  label: string;
  value?: number;
  suffix?: string;
  loading?: boolean;
}) {
  const hasValue = typeof value === "number";
  return (
    <div className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-white/[0.03] border border-white/[0.05] min-h-[68px]">
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/40">
        {label}
      </span>
      <span className="mt-1 text-white tabular-nums">
        {loading && !hasValue ? (
          <span className="inline-block w-8 h-[6px] rounded-full bg-white/10 animate-pulse" />
        ) : hasValue ? (
          <span className="text-[18px] font-bold leading-none">
            {formatCount(value!)}
            {suffix ?? ""}
          </span>
        ) : (
          <span className="text-[16px] font-bold leading-none text-white/30">
            —
          </span>
        )}
      </span>
    </div>
  );
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl bg-white/[0.035] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all min-h-[44px]"
    >
      <span className="text-[13px] font-semibold text-white/85 group-hover:text-white truncate">
        {label}
      </span>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-white/35 group-hover:text-white/65 transition-colors" />
    </a>
  );
}
