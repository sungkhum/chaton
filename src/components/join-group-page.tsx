import {
  getBulkAccessGroups,
  getPaginatedAccessGroupMembers,
  getUsersStateless,
  identity,
  ProfileEntryResponse,
} from "deso-protocol";
import { Loader2, LogIn, UserPlus, CheckCircle2, MessageSquare, AlertCircle, Users, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import { extractInviteCode, resolveInviteCode } from "../utils/invite-link";
import { cleanupOwnJoinRequests, createJoinRequest, hasExistingJoinRequest } from "../services/conversations.service";
import { GROUP_IMAGE_URL } from "../utils/extra-data";
import { PreSignupTutorial } from "./onboarding/pre-signup-tutorial";

type PageState =
  | "loading"
  | "invalid"
  | "group-not-found"
  | "not-logged-in"
  | "already-member"
  | "request-pending"
  | "can-request"
  | "submitting"
  | "submitted"
  | "is-owner";

interface GroupInfo {
  ownerKey: string;
  groupKeyName: string;
  groupImageUrl?: string;
  ownerProfile: ProfileEntryResponse | null;
  memberCount: number;
  memberCountCapped: boolean;
}

export const JoinGroupPage = () => {
  const { appUser, allAccessGroups, isLoadingUser } = useStore();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const preloadRef = useRef<HTMLImageElement | null>(null);
  const submittingRef = useRef(false);

  // Stable key for the main data-loading effect — avoid re-fetching when
  // allAccessGroups array reference changes (membership check is separate).
  const userKey = appUser?.PublicKeyBase58Check ?? null;

  // Resolve invite code and load group info
  useEffect(() => {
    if (isLoadingUser) return;

    const code = extractInviteCode(window.location.pathname);
    if (!code) {
      setPageState("invalid");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Resolve invite code to owner + group
        const resolved = await resolveInviteCode(code);
        if (cancelled) return;
        if (!resolved) {
          setPageState("invalid");
          return;
        }

        const { ownerKey, groupKeyName } = resolved;

        // 2. Validate group exists + fetch image, owner profile, and member count in parallel
        const [groupRes, profileRes, membersRes] = await Promise.all([
          getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: [
              {
                GroupOwnerPublicKeyBase58Check: ownerKey,
                GroupKeyName: groupKeyName,
              },
            ],
          }),
          getUsersStateless({
            PublicKeysBase58Check: [ownerKey],
          }),
          getPaginatedAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: ownerKey,
            AccessGroupKeyName: groupKeyName,
            MaxMembersToFetch: 50,
          }).catch(() => null),
        ]);
        if (cancelled) return;

        // Validate group exists from the single getBulkAccessGroups call
        if (groupRes.PairsNotFound?.length) {
          setPageState("group-not-found");
          return;
        }

        const ownerProfile =
          profileRes.UserList?.[0]?.ProfileEntryResponse ?? null;
        // Add 1 for the owner only if the API didn't already include them.
        const membersList = membersRes?.AccessGroupMembersBase58Check ?? [];
        const rawMemberCount = membersList.length;
        const ownerIncluded = membersList.includes(ownerKey);
        const memberCount = rawMemberCount + (ownerIncluded ? 0 : 1);
        const groupEntry = groupRes.AccessGroupEntries?.[0];
        const groupImageUrl = groupEntry?.ExtraData?.[GROUP_IMAGE_URL] || undefined;

        // Preload the group image immediately — don't wait for React render cycle.
        // The browser will cache it, so the <img> renders instantly when the card appears.
        if (groupImageUrl && !cancelled) {
          const img = new Image();
          img.src = groupImageUrl;
          img.onload = () => { if (!cancelled) setImageLoaded(true); };
          preloadRef.current = img;
        }

        const info: GroupInfo = {
          ownerKey,
          groupKeyName,
          groupImageUrl,
          ownerProfile,
          memberCount,
          memberCountCapped: rawMemberCount >= 50,
        };
        setGroupInfo(info);

        // 3. Determine page state based on auth
        if (!userKey) {
          setPageState("not-logged-in");
          return;
        }

        if (userKey === ownerKey) {
          setPageState("is-owner");
          return;
        }

        // Membership check uses allAccessGroups from store (current snapshot)
        const groups = useStore.getState().allAccessGroups;
        const isMember = groups.some(
          (g) =>
            g.AccessGroupOwnerPublicKeyBase58Check === ownerKey &&
            g.AccessGroupKeyName === groupKeyName
        );
        if (isMember) {
          setPageState("already-member");
          return;
        }

        // Check for existing join request — but only block if the user
        // hasn't been a member before. If they were approved, left, and
        // came back, the old association still exists on-chain but they
        // should be allowed to re-request.
        const hasPending = await hasExistingJoinRequest(
          userKey,
          ownerKey,
          groupKeyName
        );
        if (cancelled) return;
        // Show "request-pending" only if there's an existing request.
        // The user can always submit again (DeSo allows duplicate associations).
        setPageState(hasPending ? "request-pending" : "can-request");
      } catch (err) {
        console.error("Failed to load join page:", err);
        if (!cancelled) setPageState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userKey, isLoadingUser]);

  // Separate effect for membership — re-evaluates when allAccessGroups changes
  // without re-triggering the entire data-loading effect.
  useEffect(() => {
    if (!groupInfo || !userKey || userKey === groupInfo.ownerKey) return;
    const isMember = allAccessGroups.some(
      (g) =>
        g.AccessGroupOwnerPublicKeyBase58Check === groupInfo.ownerKey &&
        g.AccessGroupKeyName === groupInfo.groupKeyName
    );
    if (isMember) {
      setPageState("already-member");
      // Self-cleanup: delete our own stale join request association
      cleanupOwnJoinRequests(userKey, allAccessGroups).catch(() => {});
    }
  }, [allAccessGroups, groupInfo, userKey]);

  const handleRequestJoin = async () => {
    if (!appUser || !groupInfo || submittingRef.current) return;
    submittingRef.current = true;
    setPageState("submitting");
    try {
      await createJoinRequest(
        appUser.PublicKeyBase58Check,
        groupInfo.ownerKey,
        groupInfo.groupKeyName
      );
      setPageState("submitted");
    } catch (err: any) {
      console.error("Join request failed:", err);
      const msg = err?.message || err?.toString?.() || "";
      // withAuth already toasts for auth-related errors (cancelled, re-auth failed).
      // Only show our own toast for non-auth errors to avoid double-toasting.
      const isAuthError =
        msg.includes("cancelled") ||
        msg.includes("WINDOW_CLOSED") ||
        msg.includes("Re-authorization") ||
        msg.includes("derived key");
      if (!isAuthError) {
        if (msg.includes("RuleError")) {
          // DeSo blockchain rule error — show the specific reason
          const ruleMsg = msg.replace(/^.*RuleError/i, "").replace(/['"]/g, "").trim();
          toast.error(`Request failed: ${ruleMsg || "blockchain rejected the transaction"}`);
        } else {
          toast.error("Failed to send join request. Please try again.");
        }
      }
      setPageState("can-request");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleLogin = () => {
    identity.login().catch(() => {});
  };

  const handleOpenChat = () => {
    if (!groupInfo) return;
    const conversationKey =
      groupInfo.ownerKey + groupInfo.groupKeyName;
    window.location.href = `/?conversation=${encodeURIComponent(conversationKey)}`;
  };

  const groupName = groupInfo?.groupKeyName ?? "";
  const ownerUsername = groupInfo
    ? groupInfo.ownerProfile?.Username ?? groupInfo.ownerKey.slice(0, 12) + "..."
    : "";

  return (
    <div className="min-h-screen bg-[#0F1520] text-white flex flex-col items-center relative overflow-hidden">
      {/* Background orbs — use landing-orb class for blur + animation consistency */}
      <div className="landing-orb w-[500px] h-[500px] bg-[#34F080] -top-[200px] -left-[100px] opacity-[0.04]" />
      <div className="landing-orb w-[400px] h-[400px] bg-[#20E0AA] -bottom-[150px] -right-[80px] opacity-[0.03]" />

      {/* Navigation bar */}
      <nav className="w-full flex items-center justify-between h-[60px] relative z-10 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <img
              src="/ChatOn-Logo-Small.png"
              alt="ChatOn"
              className="w-8 h-8 rounded-lg"
            />
            <span className="text-sm font-black tracking-wider text-white/90">
              CHATON
            </span>
          </a>
          {!appUser && (
            <button
              onClick={handleLogin}
              className="px-5 py-2.5 text-gray-300 hover:text-white text-xs font-black transition-colors cursor-pointer"
            >
              LOG IN
            </button>
          )}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center w-full px-6 py-12">
        <div className="w-full max-w-md">
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-4" role="status">
              <Loader2 className="w-10 h-10 text-[#34F080] animate-spin" />
              <p className="text-gray-400 text-sm">Loading group info...</p>
            </div>
          )}

          {pageState === "invalid" && (
            <ErrorCard
              icon={<AlertCircle className="w-12 h-12 text-red-400" />}
              title="Invalid invite link"
              message="This invite link is invalid or has expired. Ask the group admin for a new one."
            />
          )}

          {pageState === "group-not-found" && (
            <ErrorCard
              icon={<AlertCircle className="w-12 h-12 text-red-400" />}
              title="Group not found"
              message="This group no longer exists or may have been deleted."
            />
          )}

          {(pageState === "not-logged-in" ||
            pageState === "can-request" ||
            pageState === "submitting" ||
            pageState === "submitted" ||
            pageState === "request-pending" ||
            pageState === "already-member" ||
            pageState === "is-owner") &&
            groupInfo && (
              <div className="landing-glass-card rounded-2xl md:rounded-3xl p-8 md:p-10 border border-[#34F080]/10 flex flex-col items-center gap-6 !transform-none hover:!transform-none">
                {/* Group avatar */}
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1a2235] flex items-center justify-center border-2 border-[#34F080]/20 relative">
                  {/* Always render the fallback icon as a base layer */}
                  <Users className="w-9 h-9 text-[#34F080]/60" />
                  {/* Overlay the image on top with a fade-in once loaded */}
                  {groupInfo.groupImageUrl && (
                    <img
                      src={groupInfo.groupImageUrl}
                      alt={groupName}
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                      style={{ opacity: imageLoaded ? 1 : 0 }}
                      onLoad={() => setImageLoaded(true)}
                    />
                  )}
                </div>

                {/* Group name */}
                <div className="text-center w-full">
                  <h1 className="text-2xl font-black text-white mb-1 break-words line-clamp-2">
                    {groupName}
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Created by{" "}
                    <span className="text-[#34F080]">@{ownerUsername}</span>
                    {" \u00b7 "}
                    {groupInfo.memberCountCapped ? "50+" : groupInfo.memberCount}{" "}
                    members
                  </p>
                </div>

                {/* State-specific content */}
                {pageState === "not-logged-in" && (
                  <div className="w-full flex flex-col gap-3 mt-2">
                    <p className="text-gray-300 text-sm text-center">
                      Sign in to request to join this group.
                    </p>
                    <button
                      onClick={handleLogin}
                      className="w-full px-6 py-3.5 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      Log In to Request Access
                    </button>
                    <button
                      onClick={() => setShowTutorial(true)}
                      className="w-full px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 cursor-pointer text-sm transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Create Account
                    </button>
                  </div>
                )}

                {pageState === "can-request" && (
                  <div className="w-full flex flex-col gap-3 mt-2">
                    <button
                      onClick={handleRequestJoin}
                      className="w-full px-6 py-3.5 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Request to Join
                    </button>
                    <p className="text-gray-500 text-xs text-center">
                      The group admin will review your request.
                    </p>
                  </div>
                )}

                {pageState === "submitting" && (
                  <div className="w-full flex flex-col items-center gap-3 mt-2" role="status">
                    <Loader2 className="w-6 h-6 text-[#34F080] animate-spin" />
                    <p className="text-gray-400 text-sm">
                      Sending request...
                    </p>
                  </div>
                )}

                {pageState === "submitted" && (
                  <div className="w-full flex flex-col items-center gap-3 mt-2">
                    <CheckCircle2 className="w-10 h-10 text-[#34F080]" />
                    <p className="text-gray-300 text-sm text-center">
                      Request sent! The group admin will review it shortly.
                    </p>
                  </div>
                )}

                {pageState === "request-pending" && (
                  <div className="w-full flex flex-col items-center gap-3 mt-2 bg-white/5 rounded-xl p-4">
                    <Clock className="w-8 h-8 text-yellow-400/80" />
                    <p className="text-gray-300 text-sm text-center">
                      Your request is pending approval.
                    </p>
                    <button
                      onClick={handleRequestJoin}
                      className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer transition-colors"
                    >
                      Request again
                    </button>
                  </div>
                )}

                {pageState === "already-member" && (
                  <div className="w-full flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-center gap-2 text-[#34F080] text-sm font-semibold">
                      <CheckCircle2 className="w-5 h-5" />
                      You're already a member
                    </div>
                    <button
                      onClick={handleOpenChat}
                      className="w-full px-6 py-3.5 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Open Chat
                    </button>
                  </div>
                )}

                {pageState === "is-owner" && (
                  <div className="w-full flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-center gap-2 text-[#34F080] text-sm font-semibold">
                      <CheckCircle2 className="w-5 h-5" />
                      You own this group
                    </div>
                    <button
                      onClick={handleOpenChat}
                      className="w-full px-6 py-3.5 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Open Chat
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Pre-signup tutorial modal */}
      {showTutorial && (
        <PreSignupTutorial onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
};

function ErrorCard({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="landing-glass-card rounded-2xl md:rounded-3xl p-8 md:p-10 border border-red-500/10 flex flex-col items-center gap-4 text-center !transform-none hover:!transform-none">
      {icon}
      <h1 className="text-xl font-black text-white">{title}</h1>
      <p className="text-gray-400 text-sm">{message}</p>
      <a
        href="/"
        className="mt-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-sm transition-colors"
      >
        Go to ChatOn
      </a>
    </div>
  );
}

export default JoinGroupPage;
