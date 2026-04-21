import {
  getBulkAccessGroups,
  getUsersStateless,
  ProfileEntryResponse,
} from "deso-protocol";
import { fetchGroupMemberCount } from "../services/community.service";
import {
  Loader2,
  UserPlus,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Users,
  Clock,
  X,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store";
import { resolveInviteCode } from "../utils/invite-link";
import {
  createGroupAcceptedAssociation,
  createJoinRequest,
  hasExistingJoinRequest,
} from "../services/conversations.service";
import { GROUP_DISPLAY_NAME, GROUP_IMAGE_URL } from "../utils/extra-data";

type ModalState =
  | "loading"
  | "invalid"
  | "group-not-found"
  | "already-member"
  | "request-pending"
  | "can-request"
  | "submitting"
  | "submitted";

interface GroupInfo {
  ownerKey: string;
  groupKeyName: string;
  groupDisplayName?: string;
  groupImageUrl?: string;
  ownerProfile: ProfileEntryResponse | null;
  memberCount: number;
}

export function JoinGroupModal({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const { appUser, allAccessGroups } = useStore(
    useShallow((s) => ({
      appUser: s.appUser,
      allAccessGroups: s.allAccessGroups,
    }))
  );
  const [state, setState] = useState<ModalState>("loading");
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resolved = await resolveInviteCode(code);
        if (cancelled) return;
        if (!resolved) {
          setState("invalid");
          return;
        }

        const { ownerKey, groupKeyName } = resolved;

        const [groupRes, profileRes, memberCount] = await Promise.all([
          getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: [
              {
                GroupOwnerPublicKeyBase58Check: ownerKey,
                GroupKeyName: groupKeyName,
              },
            ],
          }),
          getUsersStateless({ PublicKeysBase58Check: [ownerKey] }),
          fetchGroupMemberCount(ownerKey, groupKeyName).catch(() => 1),
        ]);
        if (cancelled) return;

        if (groupRes.PairsNotFound?.length) {
          setState("group-not-found");
          return;
        }

        const ownerProfile =
          profileRes.UserList?.[0]?.ProfileEntryResponse ?? null;
        const groupEntry = groupRes.AccessGroupEntries?.[0];
        const groupImageUrl =
          groupEntry?.ExtraData?.[GROUP_IMAGE_URL] || undefined;
        const groupDisplayName =
          groupEntry?.ExtraData?.[GROUP_DISPLAY_NAME] || undefined;

        // Preload image
        if (groupImageUrl) {
          const img = new Image();
          img.src = groupImageUrl;
          img.onload = () => {
            if (!cancelled) setImageLoaded(true);
          };
        }

        setGroupInfo({
          ownerKey,
          groupKeyName,
          groupDisplayName,
          groupImageUrl,
          ownerProfile,
          memberCount,
        });

        if (!appUser) {
          setState("can-request");
          return;
        }

        if (appUser.PublicKeyBase58Check === ownerKey) {
          setState("already-member");
          return;
        }

        const isMember = allAccessGroups.some(
          (g) =>
            g.AccessGroupOwnerPublicKeyBase58Check === ownerKey &&
            g.AccessGroupKeyName === groupKeyName
        );
        if (isMember) {
          setState("already-member");
          return;
        }

        const hasPending = await hasExistingJoinRequest(
          appUser.PublicKeyBase58Check,
          ownerKey,
          groupKeyName
        );
        if (cancelled) return;
        setState(hasPending ? "request-pending" : "can-request");
      } catch (err) {
        console.error("Join modal load failed:", err);
        if (!cancelled) setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, appUser, allAccessGroups]);

  const handleRequestJoin = async () => {
    if (!appUser || !groupInfo || submittingRef.current) return;
    submittingRef.current = true;
    setState("submitting");
    try {
      await createJoinRequest(
        appUser.PublicKeyBase58Check,
        groupInfo.ownerKey,
        groupInfo.groupKeyName
      );
      // Pre-accept so the group goes to Chats when the owner approves
      createGroupAcceptedAssociation(
        appUser.PublicKeyBase58Check,
        groupInfo.ownerKey,
        groupInfo.groupKeyName
      ).catch(() => {}); // fire-and-forget, non-critical
      setState("submitted");
    } catch (err: any) {
      console.error("Join request failed:", err);
      const msg = err?.message || err?.toString?.() || "";
      const isAuthError =
        msg.includes("cancelled") ||
        msg.includes("WINDOW_CLOSED") ||
        msg.includes("Re-authorization") ||
        msg.includes("derived key");
      if (!isAuthError) {
        if (msg.includes("RuleError")) {
          const ruleMsg = msg
            .replace(/^.*RuleError/i, "")
            .replace(/['"]/g, "")
            .trim();
          toast.error(
            `Request failed: ${
              ruleMsg || "blockchain rejected the transaction"
            }`
          );
        } else {
          toast.error("Failed to send join request. Please try again.");
        }
      }
      setState("can-request");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleOpenChat = () => {
    if (!groupInfo) return;
    const conversationKey = groupInfo.ownerKey + groupInfo.groupKeyName;
    useStore.getState().setPendingConversationKey(conversationKey);
    onClose();
    // Small delay to let the modal close before messaging-app picks up the pending key
    setTimeout(() => window.dispatchEvent(new Event("join-navigate")), 50);
  };

  const groupName =
    groupInfo?.groupDisplayName ??
    groupInfo?.groupKeyName?.replace(/\0/g, "") ??
    "";
  const ownerUsername = groupInfo
    ? groupInfo.ownerProfile?.Username ??
      groupInfo.ownerKey.slice(0, 12) + "..."
    : "";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[60] modal-backdrop-enter"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-[#0a1220] text-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto border border-blue-900/50 modal-card-enter">
          {/* Header with close */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-gray-400">
              Join Group
            </span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center gap-5">
            {state === "loading" && (
              <div
                className="flex flex-col items-center gap-3 py-8"
                role="status"
              >
                <Loader2 className="w-8 h-8 text-[#34F080] animate-spin" />
                <p className="text-gray-400 text-sm">Loading group info...</p>
              </div>
            )}

            {state === "invalid" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-base font-bold">Invalid invite link</p>
                <p className="text-gray-400 text-sm">
                  This link is invalid or has expired.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Back to Chat
                </button>
              </div>
            )}

            {state === "group-not-found" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-base font-bold">Group not found</p>
                <p className="text-gray-400 text-sm">
                  This group no longer exists.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Back to Chat
                </button>
              </div>
            )}

            {groupInfo &&
              state !== "loading" &&
              state !== "invalid" &&
              state !== "group-not-found" && (
                <>
                  {/* Group avatar */}
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a2235] flex items-center justify-center border border-white/10 relative">
                    <Users className="w-7 h-7 text-[#34F080]/60" />
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

                  <div className="text-center">
                    <h2 className="text-lg font-bold text-white mb-0.5 break-words line-clamp-2">
                      {groupName}
                    </h2>
                    <p className="text-gray-400 text-xs">
                      Created by{" "}
                      <span className="text-[#34F080]">@{ownerUsername}</span>
                      {" \u00b7 "}
                      {groupInfo.memberCount}{" "}
                      {groupInfo.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>

                  {state === "can-request" && (
                    <div className="w-full flex flex-col gap-3">
                      <button
                        onClick={handleRequestJoin}
                        className="w-full px-5 py-3 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <UserPlus className="w-4 h-4" />
                        Request to Join
                      </button>
                      <div className="bg-white/5 rounded-lg px-3 py-2.5">
                        <p className="text-gray-400 text-xs text-center leading-relaxed">
                          The group owner will be notified and can approve your
                          request. You'll see this group in your chats once
                          approved.
                        </p>
                      </div>
                    </div>
                  )}

                  {state === "submitting" && (
                    <div
                      className="flex flex-col items-center gap-2 py-2"
                      role="status"
                    >
                      <Loader2 className="w-5 h-5 text-[#34F080] animate-spin" />
                      <p className="text-gray-400 text-sm">
                        Sending request...
                      </p>
                    </div>
                  )}

                  {state === "submitted" && (
                    <div className="w-full flex flex-col items-center gap-4">
                      <CheckCircle2 className="w-8 h-8 text-[#34F080]" />
                      <div className="text-center">
                        <p className="text-white text-sm font-semibold mb-1">
                          Request sent!
                        </p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                          The group owner has been notified. Once they approve
                          your request, this group will appear in your chats
                          automatically.
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                      >
                        Back to Chat
                      </button>
                    </div>
                  )}

                  {state === "request-pending" && (
                    <div className="w-full flex flex-col items-center gap-3 bg-white/5 rounded-xl p-4">
                      <Clock className="w-7 h-7 text-yellow-400/80" />
                      <div className="text-center">
                        <p className="text-gray-300 text-sm font-medium mb-1">
                          Waiting for approval
                        </p>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          The group owner has your request. This group will
                          appear in your chats once they approve it.
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer transition-colors"
                      >
                        Back to Chat
                      </button>
                    </div>
                  )}

                  {state === "already-member" && (
                    <div className="w-full flex flex-col gap-3">
                      <div className="flex items-center justify-center gap-2 text-[#34F080] text-sm font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        You're already a member
                      </div>
                      <button
                        onClick={handleOpenChat}
                        className="w-full px-5 py-3 landing-btn-vivid text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Open Chat
                      </button>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
