import { useStore } from "../store";
import {
  AccessGroupEntryResponse,
  AccessGroupPrivateInfo,
  addAccessGroupMembers,
  countUserAssociation,
  deleteUserAssociation,
  encrypt,
  getAllAccessGroupsMemberOnly,
  getBulkAccessGroups,
  identity,
  publicKeyToBase58Check,
  removeAccessGroupMembers,
  updateAccessGroup,
  waitForTransactionFound,
} from "deso-protocol";
import { withAuth } from "../utils/with-auth";
import { Check, CheckCheck, Copy, Link2, Loader2, LogOut, Share2, Trash2, UserPlus, Users, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useKeyDown from "../hooks/useKeyDown";
import { useMembers } from "../hooks/useMembers";
import { useMobile } from "../hooks/useMobile";
import {
  ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "../utils/constants";
import { GROUP_IMAGE_URL, getGroupImageUrl } from "../utils/extra-data";
import {
  fetchPendingJoinRequests,
  JoinRequestEntry,
} from "../services/conversations.service";
import {
  buildInviteUrl,
  fetchInviteCode,
  generateInviteCode,
  registerInviteCode,
  revokeInviteCode,
} from "../utils/invite-link";
import { Conversation } from "../utils/types";
import { GroupImagePicker } from "./group-image-picker";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SearchUsers } from "./search-users";

export interface ManageMembersDialogProps {
  onSuccess: () => void;
  onLeaveGroup: (conversationKey: string, groupOwnerPublicKey: string, groupKeyName: string) => void;
  conversation: Conversation;
  conversationKey: string;
  isGroupOwner: boolean;
}

export const ManageMembersDialog = ({
  onSuccess,
  onLeaveGroup,
  conversation,
  conversationKey,
  isGroupOwner,
}: ManageMembersDialogProps) => {
  const { appUser, allAccessGroups } = useStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { members, addMember, removeMember, onPairMissing, currentMemberKeys } =
    useMembers(setLoading, open, conversation);
  const membersAreaRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();

  // Focus trap: keep Tab cycling within the dialog
  const handleTrapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleTrapFocus);
    // Focus the dialog on open
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleTrapFocus);
  }, [open, handleTrapFocus]);

  // Invite link state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteAssociationId, setInviteAssociationId] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequestEntry[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [approvingKeys, setApprovingKeys] = useState<Set<string>>(new Set());

  // Badge: count pending join requests (initialized below after groupName)
  const [joinRequestBadge, setJoinRequestBadge] = useState(0);

  const handleOpen = () => setOpen(!open);
  const groupName = conversation.messages[0].RecipientInfo.AccessGroupKeyName;
  const groupOwnerKey = conversation.messages[0].RecipientInfo.OwnerPublicKeyBase58Check;

  const currentGroupImageUrl = getGroupImageUrl(allAccessGroups, groupOwnerKey, groupName) || "";
  const [groupImageUrl, setGroupImageUrl] = useState(currentGroupImageUrl);

  // Sync local state when the dialog opens or the store value changes
  useEffect(() => {
    if (open) setGroupImageUrl(currentGroupImageUrl);
  }, [open, currentGroupImageUrl]);

  // Badge: count pending join requests.
  // Refetch on mount AND every time the dialog closes (so it picks up new requests).
  const [badgeTrigger, setBadgeTrigger] = useState(0);
  useEffect(() => {
    if (!isGroupOwner || !appUser) return;
    countUserAssociation({
      TargetUserPublicKeyBase58Check: appUser.PublicKeyBase58Check,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      AssociationValue: groupName,
    })
      .then((res) => setJoinRequestBadge(res.Count ?? 0))
      .catch(() => {});
  }, [isGroupOwner, appUser, groupName, badgeTrigger]);

  // When dialog closes, bump the trigger so badge refetches
  useEffect(() => {
    if (!open) setBadgeTrigger((n) => n + 1);
  }, [open]);

  // Fetch invite code and join requests when dialog opens (owner only)
  useEffect(() => {
    if (!open || !isGroupOwner || !appUser) return;
    let cancelled = false;

    // Fetch existing invite code
    fetchInviteCode(appUser.PublicKeyBase58Check, groupName)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setInviteCode(result.code);
          setInviteAssociationId(result.associationId);
        }
      })
      .catch(() => {});

    // Fetch pending join requests
    setJoinRequestsLoading(true);
    fetchPendingJoinRequests(appUser.PublicKeyBase58Check, groupName)
      .then((requests) => {
        if (cancelled) return;
        // Filter out users who are already members
        const memberSet = new Set(currentMemberKeys);
        const pending = requests.filter(
          (r) => !memberSet.has(r.requesterPublicKey)
        );
        setJoinRequests(pending);
        // Sync badge with actual filtered count
        setJoinRequestBadge(pending.length);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setJoinRequestsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isGroupOwner, appUser, groupName, currentMemberKeys]);

  const handleGroupImageSave = async (newImageUrl: string) => {
    if (!appUser || !isGroupOwner) return;

    // Find the access group's public key
    const group = allAccessGroups.find(
      (g) =>
        g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
        g.AccessGroupKeyName === groupName
    );
    if (!group) {
      toast.error("Could not find access group info");
      return;
    }

    const oldImageUrl = currentGroupImageUrl;

    // Optimistic update
    setGroupImageUrl(newImageUrl);
    const updatedGroups = allAccessGroups.map((g) => {
      if (
        g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
        g.AccessGroupKeyName === groupName
      ) {
        const newExtraData = { ...(g.ExtraData || {}) };
        if (newImageUrl) {
          newExtraData[GROUP_IMAGE_URL] = newImageUrl;
        } else {
          delete newExtraData[GROUP_IMAGE_URL];
        }
        return { ...g, ExtraData: newExtraData };
      }
      return g;
    });
    useStore.setState({ allAccessGroups: updatedGroups });

    try {
      // Preserve existing ExtraData keys from other apps/features
      const mergedExtraData = { ...(group.ExtraData || {}) };
      if (newImageUrl) {
        mergedExtraData[GROUP_IMAGE_URL] = newImageUrl;
      } else {
        mergedExtraData[GROUP_IMAGE_URL] = "";
      }

      await withAuth(() =>
        updateAccessGroup({
          AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          AccessGroupKeyName: groupName,
          AccessGroupPublicKeyBase58Check: group.AccessGroupPublicKeyBase58Check,
          MinFeeRateNanosPerKB: 1000,
          ExtraData: mergedExtraData,
        })
      );
      toast.success("Group image updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update group image");
      // Rollback
      setGroupImageUrl(oldImageUrl);
      const rollbackGroups = allAccessGroups.map((g) => {
        if (
          g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
          g.AccessGroupKeyName === groupName
        ) {
          const newExtraData = { ...(g.ExtraData || {}) };
          if (oldImageUrl) {
            newExtraData[GROUP_IMAGE_URL] = oldImageUrl;
          } else {
            delete newExtraData[GROUP_IMAGE_URL];
          }
          return { ...g, ExtraData: newExtraData };
        }
        return g;
      });
      useStore.setState({ allAccessGroups: rollbackGroups });
    }
  };

  useKeyDown(() => {
    if (open) setOpen(false);
  }, ["Escape"]);

  const formSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const areMembersDefined = Array.isArray(members) && members.length > 0;
    if (!areMembersDefined) {
      toast.error("At least one member should be added");
      return;
    }

    const memberKeys = members.map((e) => e.id);
    // js-set-map-lookups: O(1) membership checks instead of O(n) .includes()
    const currentSet = new Set(currentMemberKeys);
    const memberSet = new Set(memberKeys);
    const memberKeysToAdd = memberKeys.filter((k) => !currentSet.has(k));
    const memberKeysToRemove = currentMemberKeys.filter((k) => !memberSet.has(k));

    setUpdating(true);
    try {
      // Sequential: add members first, then remove. These are irreversible
      // blockchain transactions — if add fails we must not have already removed.
      await addMembersAction(groupName, memberKeysToAdd);
      await removeMembersAction(groupName, memberKeysToRemove);
    } finally {
      setUpdating(false);
    }

    onSuccess();
    handleOpen();
  };

  const addMembersAction = async (groupName: string, memberKeys: Array<string>) => {
    if (!appUser) return Promise.reject(new Error("You are not logged in."));
    return updateMembers(
      groupName,
      memberKeys,
      async (groupEntries?: Array<AccessGroupEntryResponse>) => {
        let accessGroupKeyInfo: AccessGroupPrivateInfo;
        try {
          const resp = await getAllAccessGroupsMemberOnly({
            PublicKeyBase58Check: appUser.PublicKeyBase58Check,
          });

          const encryptedKey = (resp.AccessGroupsMember ?? []).find(
            (entry) =>
              entry?.AccessGroupOwnerPublicKeyBase58Check === appUser.PublicKeyBase58Check &&
              entry?.AccessGroupKeyName === groupName &&
              entry?.AccessGroupMemberEntryResponse
          )?.AccessGroupMemberEntryResponse?.EncryptedKey;

          if (encryptedKey) {
            const keys = await identity.decryptAccessGroupKeyPair(encryptedKey);
            const pkBs58Check = await publicKeyToBase58Check(keys.public);
            accessGroupKeyInfo = {
              AccessGroupPublicKeyBase58Check: pkBs58Check,
              AccessGroupPrivateKeyHex: keys.seedHex,
              AccessGroupKeyName: groupName,
            };
          }
        } catch (e) {
          accessGroupKeyInfo = await identity.accessGroupStandardDerivation(groupName);
        }

        const memberList = await Promise.all(
          (groupEntries || []).map(async (entry) => ({
            AccessGroupMemberPublicKeyBase58Check: entry.AccessGroupOwnerPublicKeyBase58Check,
            AccessGroupMemberKeyName: entry.AccessGroupKeyName,
            EncryptedKey: await encrypt(
              entry.AccessGroupPublicKeyBase58Check,
              accessGroupKeyInfo!.AccessGroupPrivateKeyHex
            ),
          }))
        );

        const { submittedTransactionResponse } = await withAuth(() =>
          addAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: memberList,
            MinFeeRateNanosPerKB: 1000,
          })
        );

        if (!submittedTransactionResponse) {
          throw new Error("Failed to submit transaction to add members to group.");
        }
        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);
      }
    );
  };

  const removeMembersAction = async (groupName: string, memberKeys: Array<string>) => {
    if (!appUser) {
      toast.error("You are not logged in.");
      return;
    }
    return updateMembers(
      groupName,
      memberKeys,
      async (groupEntries?: Array<AccessGroupEntryResponse>) => {
        const { submittedTransactionResponse } = await withAuth(() =>
          removeAccessGroupMembers({
            AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
            AccessGroupKeyName: groupName,
            AccessGroupMemberList: (groupEntries || []).map((entry) => ({
              AccessGroupMemberPublicKeyBase58Check: entry.AccessGroupOwnerPublicKeyBase58Check,
              AccessGroupMemberKeyName: entry.AccessGroupKeyName,
              EncryptedKey: "",
            })),
            MinFeeRateNanosPerKB: 1000,
          })
        );

        if (!submittedTransactionResponse) {
          throw new Error("Failed to submit transaction to update group members.");
        }
        return waitForTransactionFound(submittedTransactionResponse.TxnHashHex);
      }
    );
  };

  // ── Invite Link Handlers ──

  const handleCreateInviteLink = async () => {
    if (!appUser) return;
    setInviteLoading(true);
    try {
      const code = generateInviteCode();
      const associationId = await registerInviteCode(
        appUser.PublicKeyBase58Check,
        code,
        groupName
      );
      setInviteCode(code);
      setInviteAssociationId(associationId);
      toast.success("Invite link created");
    } catch (err: any) {
      if (err?.message?.includes("collision")) {
        // Retry once with a new code
        try {
          const code = generateInviteCode();
          const associationId = await registerInviteCode(
            appUser.PublicKeyBase58Check,
            code,
            groupName
          );
          setInviteCode(code);
          setInviteAssociationId(associationId);
          toast.success("Invite link created");
        } catch {
          toast.error("Failed to create invite link");
        }
      } else {
        toast.error("Failed to create invite link");
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteCode) return;
    const url = buildInviteUrl(inviteCode);
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShareInviteLink = async () => {
    if (!inviteCode) return;
    const url = buildInviteUrl(inviteCode);
    try {
      await navigator.share({ title: `Join ${groupName}`, url });
    } catch {
      // User cancelled or share not supported — fall back to copy
      handleCopyInviteLink();
    }
  };

  const handleRevokeInviteLink = async () => {
    if (!appUser || !inviteAssociationId) return;
    if (!window.confirm("Revoke this invite link? Anyone with this link will no longer be able to join.")) return;
    setInviteLoading(true);
    try {
      await revokeInviteCode(appUser.PublicKeyBase58Check, inviteAssociationId);
      setInviteCode(null);
      setInviteAssociationId(null);
      toast.success("Invite link revoked");
    } catch {
      toast.error("Failed to revoke invite link");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Join Request Handlers ──

  const handleApproveRequests = async (keysToApprove: string[]) => {
    if (!appUser || keysToApprove.length === 0) return;

    setApprovingKeys(new Set(keysToApprove));
    try {
      await addMembersAction(groupName, keysToApprove);

      // Remove approved from the local list
      const approvedSet = new Set(keysToApprove);
      const approvedRequests = joinRequests.filter((r) => approvedSet.has(r.requesterPublicKey));
      setJoinRequests((prev) =>
        prev.filter((r) => !approvedSet.has(r.requesterPublicKey))
      );
      setSelectedRequests(new Set());
      // Update badge count
      setJoinRequestBadge((prev) => Math.max(0, prev - keysToApprove.length));
      toast.success(
        keysToApprove.length === 1
          ? "Member approved"
          : `${keysToApprove.length} members approved`
      );

      // Best-effort cleanup: delete join request associations on-chain.
      // The owner is the target, not the creator — DeSo may reject this.
      // If it fails, the filter-based approach keeps the UI correct.
      if (appUser) {
        const ownerKey = appUser.PublicKeyBase58Check;
        Promise.allSettled(
          approvedRequests.map((r) =>
            deleteUserAssociation(
              {
                TransactorPublicKeyBase58Check: ownerKey,
                AssociationID: r.associationId,
              },
              { checkPermissions: false }
            )
          )
        ).catch(() => {});
      }
    } catch {
      toast.error("Failed to approve members");
    } finally {
      setApprovingKeys(new Set());
    }
  };

  const handleDismissRequest = (key: string) => {
    setJoinRequests((prev) => prev.filter((r) => r.requesterPublicKey !== key));
    setSelectedRequests((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setJoinRequestBadge((prev) => Math.max(0, prev - 1));
  };

  const toggleRequestSelection = (key: string) => {
    setSelectedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRequests.size === joinRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(joinRequests.map((r) => r.requesterPublicKey)));
    }
  };

  const updateMembers = async (
    groupName: string,
    memberKeys: Array<string>,
    updateAction: (entries?: Array<AccessGroupEntryResponse>) => Promise<void>
  ) => {
    if (memberKeys.length === 0) return;

    const { AccessGroupEntries, PairsNotFound } = await getBulkAccessGroups({
      GroupOwnerAndGroupKeyNamePairs: memberKeys.map((pubKey) => ({
        GroupOwnerPublicKeyBase58Check: pubKey,
        GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
      })),
    });

    if (PairsNotFound?.length) {
      onPairMissing();
      return;
    }

    await updateAction(AccessGroupEntries).catch(() =>
      toast.error("Something went wrong while submitting the transaction")
    );
  };

  return (
    <Fragment>
      <button
        onClick={handleOpen}
        className="text-blue-400 bg-transparent p-0 flex items-center cursor-pointer relative overflow-visible"
      >
        <Users className="mr-2 w-6 h-6" />
        <span className="hidden items-center md:flex font-medium text-base">
          View Members
        </span>
        {joinRequestBadge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 md:-top-1 md:right-auto md:-left-0.5 min-w-[18px] h-[18px] rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {joinRequestBadge > 99 ? "99+" : joinRequestBadge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} role="presentation" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="manage-members-title"
              tabIndex={-1}
              className="bg-[#050e1d] text-blue-100 border border-blue-900 w-full max-w-[480px] md:max-w-lg rounded-lg max-h-[90vh] overflow-y-auto custom-scrollbar outline-none"
            >
              <div className="text-blue-100 p-5 border-b border-blue-600/20">
                <div className="flex justify-between w-full items-center">
                  <div className="flex items-center gap-4">
                    {isGroupOwner ? (
                      <GroupImagePicker
                        imageUrl={groupImageUrl}
                        onImageChange={handleGroupImageSave}
                        groupName={groupName}
                        diameter={56}
                      />
                    ) : (
                      <MessagingDisplayAvatar
                        publicKey={groupName}
                        groupChat
                        groupImageUrl={currentGroupImageUrl}
                        diameter={56}
                      />
                    )}
                    <div>
                      <span id="manage-members-title" className="text-xl font-semibold">
                        {groupName}
                      </span>
                      <div className="text-sm text-blue-300/60">
                        {loading ? (
                          <Loader2 className="w-4 h-4 inline animate-spin" />
                        ) : (
                          `${currentMemberKeys.length} members`
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="pl-2 cursor-pointer"
                    aria-label="Close dialog"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Invite Link Section (owner only) */}
              {isGroupOwner && (
                <div className="px-5 py-3 border-b border-blue-600/20">
                  {inviteCode ? (
                    <div className="space-y-2">
                      <div className="bg-blue-900/20 border border-blue-600/20 rounded-lg px-3 py-2 text-sm text-blue-200 truncate font-mono">
                        {buildInviteUrl(inviteCode)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-blue-900/20 border border-blue-600/20 text-blue-300 hover:bg-blue-900/40 cursor-pointer"
                          title="Copy link"
                        >
                          {inviteCopied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        {typeof navigator.share === "function" && (
                          <button
                            type="button"
                            onClick={handleShareInviteLink}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-blue-900/20 border border-blue-600/20 text-blue-300 hover:bg-blue-900/40 cursor-pointer"
                            title="Share link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={handleRevokeInviteLink}
                          disabled={inviteLoading}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer disabled:opacity-50"
                          title="Revoke link"
                        >
                          {inviteLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateInviteLink}
                      disabled={inviteLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-900/20 border border-blue-600/20 text-blue-300 hover:bg-blue-900/40 text-sm font-medium cursor-pointer disabled:opacity-50"
                    >
                      {inviteLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      Create Invite Link
                    </button>
                  )}
                </div>
              )}

              <form name="start-group-chat-form" onSubmit={formSubmit}>
                <div className="p-5 pb-0">
                  <div className="mb-0">
                    {/* Join Requests Section (owner only) */}
                    {isGroupOwner && joinRequests.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-blue-200 flex items-center gap-1.5">
                            <UserPlus className="w-4 h-4" />
                            Join Requests ({joinRequests.length})
                          </span>
                          <div className="flex items-center gap-2">
                            {joinRequests.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={toggleSelectAll}
                                  className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                                >
                                  {selectedRequests.size === joinRequests.length
                                    ? "Deselect all"
                                    : "Select all"}
                                </button>
                                {selectedRequests.size > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleApproveRequests(
                                        Array.from(selectedRequests)
                                      )
                                    }
                                    disabled={approvingKeys.size > 0}
                                    className="text-xs px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {approvingKeys.size > 0 ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCheck className="w-3 h-3" />
                                    )}
                                    Approve ({selectedRequests.size})
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {joinRequests.map((req) => {
                            const username =
                              req.profile?.Username ||
                              req.requesterPublicKey.slice(0, 12) + "...";
                            const isApproving = approvingKeys.has(
                              req.requesterPublicKey
                            );
                            const isSelected = selectedRequests.has(
                              req.requesterPublicKey
                            );
                            return (
                              <div
                                key={req.requesterPublicKey}
                                className={`flex items-center p-2 md:p-3 rounded-md border cursor-pointer transition-colors hover:bg-blue-900/30 ${
                                  isSelected
                                    ? "bg-green-500/10 border-green-500/20"
                                    : "bg-blue-900/20 border-blue-600/20"
                                }`}
                                onClick={() =>
                                  toggleRequestSelection(
                                    req.requesterPublicKey
                                  )
                                }
                              >
                                {joinRequests.length > 1 && (
                                  <div
                                    className={`w-5 h-5 rounded border mr-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? "bg-green-500/30 border-green-500/50"
                                        : "border-blue-600/40"
                                    }`}
                                  >
                                    {isSelected && (
                                      <Check className="w-3 h-3 text-green-400" />
                                    )}
                                  </div>
                                )}
                                <MessagingDisplayAvatar
                                  username={username}
                                  publicKey={req.requesterPublicKey}
                                  diameter={isMobile ? 36 : 42}
                                  classNames="mx-0"
                                />
                                <div className="flex-1 ml-2 md:ml-3 min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {username}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveRequests([
                                        req.requesterPublicKey,
                                      ]);
                                    }}
                                    disabled={isApproving}
                                    className="rounded-full px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/30 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isApproving ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    <span className="hidden sm:inline">Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissRequest(req.requesterPublicKey);
                                    }}
                                    className="rounded-full p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 cursor-pointer"
                                    title="Dismiss"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isGroupOwner && joinRequestsLoading && (
                      <div className="flex items-center gap-2 text-sm text-blue-300/60 mb-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking for join requests...
                      </div>
                    )}

                    {isGroupOwner && !joinRequestsLoading && joinRequests.length === 0 && (
                      <div className="text-sm text-blue-300/40 mb-3 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4" />
                        No pending join requests
                      </div>
                    )}

                    {isGroupOwner && (
                      <SearchUsers
                        className="text-white placeholder:text-blue-100 bg-blue-900/20 placeholder-gray"
                        onSelected={(member) =>
                          addMember(member, () => {
                            setTimeout(() => {
                              membersAreaRef.current?.scrollTo(0, membersAreaRef.current.scrollHeight);
                            }, 0);
                          })
                        }
                      />
                    )}

                    <div
                      className="max-h-[400px] mt-3 pr-3 overflow-y-auto overflow-x-hidden custom-scrollbar"
                      ref={membersAreaRef}
                    >
                      {loading ? (
                        <div className="text-center">
                          <Loader2 className="w-11 h-11 mt-4 animate-spin text-blue-600 mx-auto" />
                        </div>
                      ) : (
                        members.map((member) => (
                          <div
                            className="flex p-1.5 md:p-4 items-center cursor-pointer text-white bg-blue-900/20 border border-blue-600/20 rounded-md my-2"
                            key={member.id}
                          >
                            <MessagingDisplayAvatar
                              username={member.text}
                              publicKey={member.id}
                              diameter={isMobile ? 40 : 50}
                              classNames="mx-0"
                            />
                            <div className="flex justify-between items-center flex-1 overflow-auto">
                              <div className="mx-2 md:ml-4 max-w-[calc(100%-105px)]">
                                <div className="font-medium truncate">{member.text}</div>
                                {isGroupOwner && currentMemberKeys.includes(member.id) && (
                                  <div className="text-xs md:text-sm text-blue-300/80 mt-1">
                                    Already in the chat
                                  </div>
                                )}
                              </div>
                              {isGroupOwner && member.id !== appUser?.PublicKeyBase58Check && (
                                <button
                                  className="rounded-full mr-1 md:mr-3 px-3 py-2 border text-white bg-red-400/20 hover:bg-red-400/30 border-red-600/60 text-sm md:px-4 cursor-pointer"
                                  onClick={() => removeMember(member.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between p-5 border-t border-blue-600/20 gap-3">
                  {!isGroupOwner && (
                    <button
                      onClick={() => {
                        const ownerKey = conversation.messages[0]?.RecipientInfo?.OwnerPublicKeyBase58Check;
                        if (ownerKey) {
                          setOpen(false);
                          onLeaveGroup(conversationKey, ownerKey, groupName);
                        }
                      }}
                      type="button"
                      className="rounded-full py-2 bg-red-500/15 border border-red-500/30 text-sm px-4 text-red-400 hover:bg-red-500/25 cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4" />
                      Leave Group
                    </button>
                  )}
                  <div className="flex gap-3 ml-auto">
                    {isGroupOwner && (
                      <>
                        <button
                          onClick={handleOpen}
                          type="button"
                          className="rounded-full py-2 bg-transparent border border-blue-600/60 text-sm px-4 text-blue-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-[#ffda59] text-[#6d4800] rounded-full py-2 hover:brightness-95 text-sm px-4 flex items-center cursor-pointer"
                          disabled={updating}
                        >
                          {updating && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                          <span>Update Group</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </Fragment>
  );
};
