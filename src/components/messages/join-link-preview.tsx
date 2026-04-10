import {
  Users,
  UserPlus,
  MessageSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getBulkAccessGroups,
  getUsersStateless,
  ProfileEntryResponse,
} from "deso-protocol";
import { fetchGroupMemberCountQuick } from "../../services/community.service";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../../store";
import { resolveInviteCode } from "../../utils/invite-link";
import { GROUP_DISPLAY_NAME, GROUP_IMAGE_URL } from "../../utils/extra-data";

type PreviewState = "loading" | "resolved" | "invalid";

interface GroupInfo {
  ownerKey: string;
  groupKeyName: string;
  groupDisplayName?: string;
  groupImageUrl?: string;
  ownerProfile: ProfileEntryResponse | null;
  memberCount: number;
  memberCountCapped?: boolean;
}

export function JoinLinkPreview({ code }: { code: string }) {
  const { appUserPublicKey, allAccessGroups } = useStore(
    useShallow((s) => ({
      appUserPublicKey: s.appUser?.PublicKeyBase58Check ?? null,
      allAccessGroups: s.allAccessGroups,
    }))
  );
  const [state, setState] = useState<PreviewState>("loading");
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Derive isMember reactively from store state — no re-fetch needed when groups change
  const isMember = groupInfo
    ? appUserPublicKey === groupInfo.ownerKey ||
      allAccessGroups.some(
        (g) =>
          g.AccessGroupOwnerPublicKeyBase58Check === groupInfo.ownerKey &&
          g.AccessGroupKeyName === groupInfo.groupKeyName
      )
    : false;

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

        const [groupRes, profileRes, memberCountResult] = await Promise.all([
          getBulkAccessGroups({
            GroupOwnerAndGroupKeyNamePairs: [
              {
                GroupOwnerPublicKeyBase58Check: ownerKey,
                GroupKeyName: groupKeyName,
              },
            ],
          }),
          getUsersStateless({ PublicKeysBase58Check: [ownerKey] }).catch(
            () => null
          ),
          fetchGroupMemberCountQuick(ownerKey, groupKeyName, 1).catch(() => ({
            count: 1,
            capped: false,
          })),
        ]);
        if (cancelled) return;

        const groupEntry = groupRes.AccessGroupEntries?.[0];
        if (groupRes.PairsNotFound?.length || !groupEntry) {
          setState("invalid");
          return;
        }

        const ownerProfile =
          profileRes?.UserList?.[0]?.ProfileEntryResponse ?? null;
        const groupImageUrl =
          groupEntry.ExtraData?.[GROUP_IMAGE_URL] || undefined;
        const groupDisplayName =
          groupEntry.ExtraData?.[GROUP_DISPLAY_NAME] || undefined;

        setGroupInfo({
          ownerKey,
          groupKeyName,
          groupDisplayName,
          groupImageUrl,
          ownerProfile,
          memberCount: memberCountResult.count,
          memberCountCapped: memberCountResult.capped,
        });
        setState("resolved");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleClick = () => {
    if (!groupInfo) return;

    if (isMember) {
      const conversationKey = groupInfo.ownerKey + groupInfo.groupKeyName;
      useStore.getState().setPendingConversationKey(conversationKey);
      setTimeout(() => window.dispatchEvent(new Event("join-navigate")), 50);
    } else {
      useStore.getState().setPendingJoinCode(code);
    }
  };

  if (state === "loading") {
    return (
      <div className="mt-1.5 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-700/30 rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#34F080]/60 animate-spin shrink-0" />
          <span className="text-[13px] text-gray-400">
            Loading group invite...
          </span>
        </div>
      </div>
    );
  }

  if (state === "invalid" || !groupInfo) {
    return (
      <div className="mt-1.5 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-gray-600/30 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-gray-500 shrink-0" />
          <span className="text-[13px] text-gray-500">
            Invalid or expired invite link
          </span>
        </div>
      </div>
    );
  }

  const groupName =
    groupInfo.groupDisplayName ??
    groupInfo.groupKeyName?.replace(/\0/g, "") ??
    "";
  const ownerUsername =
    groupInfo.ownerProfile?.Username ?? groupInfo.ownerKey.slice(0, 12) + "...";

  return (
    <div className="mt-1.5 rounded-lg overflow-hidden">
      <button
        onClick={handleClick}
        className="w-full text-left bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-700/30 rounded-lg overflow-hidden hover:brightness-110 transition cursor-pointer group"
      >
        <div className="p-3 flex items-center gap-3">
          {/* Group avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a2235] flex items-center justify-center border border-[#34F080]/20 shrink-0 relative">
            <Users className="w-4 h-4 text-[#34F080]/60" />
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

          {/* Group info */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-white font-medium leading-snug truncate">
              {groupName}
            </div>
            <div className="text-[11px] text-gray-500 leading-snug truncate">
              @{ownerUsername}
              {" \u00b7 "}
              {groupInfo.memberCount}
              {groupInfo.memberCountCapped ? "+" : ""}{" "}
              {groupInfo.memberCount === 1 && !groupInfo.memberCountCapped
                ? "member"
                : "members"}
            </div>
          </div>

          {/* Action hint */}
          <div className="shrink-0">
            {isMember ? (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34F080]/10 text-[#34F080] text-[11px] font-semibold group-hover:bg-[#34F080]/20 transition-colors">
                <MessageSquare className="w-3 h-3" />
                Open
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34F080]/10 text-[#34F080] text-[11px] font-semibold group-hover:bg-[#34F080]/20 transition-colors">
                <UserPlus className="w-3 h-3" />
                Join
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
