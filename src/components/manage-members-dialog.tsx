import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store";
import {
  AccessGroupEntryResponse,
  AccessGroupPrivateInfo,
  addAccessGroupMembers,
  deleteUserAssociation,
  encrypt,
  getAllAccessGroupsMemberOnly,
  getBulkAccessGroups,
  getPaginatedAccessGroupMembers,
  identity,
  publicKeyToBase58Check,
  removeAccessGroupMembers,
  updateAccessGroup,
  waitForTransactionFound,
} from "deso-protocol";
import { withAuth } from "../utils/with-auth";
import { Check, CheckCheck, Copy, Globe, Link2, Loader2, LogOut, Pencil, Share2, Trash2, UserPlus, Users, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useKeyDown from "../hooks/useKeyDown";
import { useMembers } from "../hooks/useMembers";
import { useMobile } from "../hooks/useMobile";
import { usePresence } from "../hooks/usePresence";
import { formatLastSeen } from "../utils/helpers";
import {
  ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
} from "../utils/constants";
import { GROUP_DISPLAY_NAME, GROUP_IMAGE_URL, getGroupDisplayName, getGroupImageUrl } from "../utils/extra-data";
import {
  createRejectAssociation,
  fetchPendingJoinRequests,
  fetchRejectedJoinRequestKeys,
  JoinRequestEntry,
  sendSystemMessage,
} from "../services/conversations.service";
import {
  buildInviteUrl,
  fetchInviteCode,
  registerInviteCode,
  revokeInviteCode,
} from "../utils/invite-link";
import { Conversation } from "../utils/types";
import {
  fetchCommunityListing,
  listGroupInCommunity,
  unlistGroupFromCommunity,
  updateCommunityListing,
} from "../services/community.service";
import { clearCommunityCache } from "./community-tab";
import { GroupImagePicker } from "./group-image-picker";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { nameOrFormattedKey, SearchUsers } from "./search-users";

export interface ManageMembersDialogProps {
  onSuccess: () => void;
  onLeaveGroup: (conversationKey: string, groupOwnerPublicKey: string, groupKeyName: string) => void;
  onOptimisticSystemMessage: (members: Array<{ pk: string; un: string }>) => void;
  conversation: Conversation;
  conversationKey: string;
  isGroupOwner: boolean;
}

export const ManageMembersDialog = ({
  onSuccess,
  onLeaveGroup,
  onOptimisticSystemMessage,
  conversation,
  conversationKey,
  isGroupOwner,
}: ManageMembersDialogProps) => {
  const { appUser, allAccessGroups, decrementJoinRequestCount } = useStore(useShallow((s) => ({ appUser: s.appUser, allAccessGroups: s.allAccessGroups, decrementJoinRequestCount: s.decrementJoinRequestCount })));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { members, addMember, addMemberDirect, removeMember, onPairMissing, currentMemberKeys } =
    useMembers(setLoading, open, conversation);
  const membersAreaRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();
  const { getPresence, fetchPresenceForKeys } = usePresence();

  // Fetch presence when dialog opens and members are loaded
  useEffect(() => {
    if (open && members.length > 0) {
      fetchPresenceForKeys(members.map((m) => m.id));
    }
  }, [open, members, fetchPresenceForKeys]);

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

  // Community listing state
  const [isCommunityListed, setIsCommunityListed] = useState(false);
  const [communityAssociationId, setCommunityAssociationId] = useState<string | null>(null);
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityToggling, setCommunityToggling] = useState(false);
  const [communitySaving, setCommunitySaving] = useState(false);
  const [savedDescription, setSavedDescription] = useState("");

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequestEntry[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [approvingKeys, setApprovingKeys] = useState<Set<string>>(new Set());
  const [rejectingKeys, setRejectingKeys] = useState<Set<string>>(new Set());
  const approvingRef = useRef(false);

  // Badge: count pending join requests (initialized below after groupName)
  const [joinRequestBadge, setJoinRequestBadge] = useState(0);

  const handleOpen = () => setOpen(!open);
  const groupName = conversation.messages[0].RecipientInfo.AccessGroupKeyName;
  const groupOwnerKey = conversation.messages[0].RecipientInfo.OwnerPublicKeyBase58Check;

  const currentGroupImageUrl = getGroupImageUrl(allAccessGroups, groupOwnerKey, groupName) || "";
  const [groupImageUrl, setGroupImageUrl] = useState(currentGroupImageUrl);

  const currentDisplayName = getGroupDisplayName(allAccessGroups, groupOwnerKey, groupName) || groupName.replace(/\0/g, "");
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(currentDisplayName);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameSaveInFlightRef = useRef(false);

  // Sync local state when the dialog opens or the store value changes
  useEffect(() => {
    if (open) {
      setGroupImageUrl(currentGroupImageUrl);
      setEditNameValue(currentDisplayName);
      setEditingName(false);
    }
  }, [open, currentGroupImageUrl, currentDisplayName]);

  // Badge: fetch join requests AND current members independently, then filter.
  // currentMemberKeys is empty when the dialog is closed, so we fetch members
  // directly to get an accurate count.
  const [badgeTrigger, setBadgeTrigger] = useState(0);
  useEffect(() => {
    if (!isGroupOwner || !appUser) return;
    let cancelled = false;
    Promise.all([
      fetchPendingJoinRequests(appUser.PublicKeyBase58Check, groupName),
      getPaginatedAccessGroupMembers({
        AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
        AccessGroupKeyName: groupName,
        MaxMembersToFetch: 200,
      }).catch(() => null),
      fetchRejectedJoinRequestKeys(appUser.PublicKeyBase58Check, groupName),
    ])
      .then(([requests, membersRes, rejectedKeys]) => {
        if (cancelled) return;
        const memberKeys = membersRes?.AccessGroupMembersBase58Check ?? [];
        // Include the owner (not returned by the members API)
        const memberSet = new Set([...memberKeys, appUser.PublicKeyBase58Check]);
        const pending = requests.filter(
          (r) => !memberSet.has(r.requesterPublicKey) && !rejectedKeys.has(r.requesterPublicKey)
        );
        setJoinRequestBadge(pending.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isGroupOwner, appUser, groupName, badgeTrigger]);

  // Refresh badge when dialog closes (skip the initial mount where open=false)
  const dialogOpenedRef = useRef(false);
  useEffect(() => {
    if (open) {
      dialogOpenedRef.current = true;
    } else if (dialogOpenedRef.current) {
      setBadgeTrigger((n) => n + 1);
    }
  }, [open]);

  useEffect(() => {
    if (!isGroupOwner) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setBadgeTrigger((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isGroupOwner]);

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

    // Fetch community listing status
    fetchCommunityListing(appUser.PublicKeyBase58Check, groupName)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setIsCommunityListed(true);
          setCommunityAssociationId(result.associationId);
          setCommunityDescription(result.description);
          setSavedDescription(result.description);
        } else {
          setIsCommunityListed(false);
          setCommunityAssociationId(null);
          setCommunityDescription("");
          setSavedDescription("");
        }
      })
      .catch(() => {});

    // Fetch pending join requests + rejected keys in parallel, then filter
    setJoinRequestsLoading(true);
    Promise.all([
      fetchPendingJoinRequests(appUser.PublicKeyBase58Check, groupName),
      fetchRejectedJoinRequestKeys(appUser.PublicKeyBase58Check, groupName),
    ])
      .then(([requests, rejectedKeys]) => {
        if (cancelled) return;
        // Filter out users who are already members or previously rejected
        const memberSet = new Set(currentMemberKeys);
        const pending = requests.filter(
          (r) =>
            !memberSet.has(r.requesterPublicKey) &&
            !rejectedKeys.has(r.requesterPublicKey)
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

  const handleGroupNameSave = async () => {
    if (nameSaveInFlightRef.current) return;
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === currentDisplayName || !appUser || !isGroupOwner) {
      setEditingName(false);
      setEditNameValue(currentDisplayName);
      return;
    }

    const group = allAccessGroups.find(
      (g) =>
        g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
        g.AccessGroupKeyName === groupName
    );
    if (!group) {
      toast.error("Could not find access group info");
      return;
    }

    const oldDisplayName = currentDisplayName;
    nameSaveInFlightRef.current = true;
    setSavingName(true);
    setEditingName(false);

    // Optimistic update
    const updatedGroups = allAccessGroups.map((g) => {
      if (
        g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
        g.AccessGroupKeyName === groupName
      ) {
        return { ...g, ExtraData: { ...(g.ExtraData || {}), [GROUP_DISPLAY_NAME]: trimmed } };
      }
      return g;
    });
    useStore.setState({ allAccessGroups: updatedGroups });

    try {
      const mergedExtraData = { ...(group.ExtraData || {}), [GROUP_DISPLAY_NAME]: trimmed };

      await withAuth(() =>
        updateAccessGroup({
          AccessGroupOwnerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          AccessGroupKeyName: groupName,
          AccessGroupPublicKeyBase58Check: group.AccessGroupPublicKeyBase58Check,
          MinFeeRateNanosPerKB: 1000,
          ExtraData: mergedExtraData,
        })
      );
      toast.success("Group name updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update group name");
      // Rollback
      setEditNameValue(oldDisplayName);
      const rollbackGroups = allAccessGroups.map((g) => {
        if (
          g.AccessGroupOwnerPublicKeyBase58Check === groupOwnerKey &&
          g.AccessGroupKeyName === groupName
        ) {
          return { ...g, ExtraData: { ...(g.ExtraData || {}), [GROUP_DISPLAY_NAME]: oldDisplayName } };
        }
        return g;
      });
      useStore.setState({ allAccessGroups: rollbackGroups });
    } finally {
      nameSaveInFlightRef.current = false;
      setSavingName(false);
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

    if (updating) return;
    setUpdating(true);
    try {
      // Sequential: add members first, then remove. These are irreversible
      // blockchain transactions — if add fails we must not have already removed.
      await addMembersAction(groupName, memberKeysToAdd);
      await removeMembersAction(groupName, memberKeysToRemove);

      // Best-effort: send system log message for newly added members
      if (appUser && memberKeysToAdd.length > 0) {
        const addedMembers = members
          .filter((m) => memberKeysToAdd.includes(m.id))
          .map((m) => ({ pk: m.id, un: m.text }));
        onOptimisticSystemMessage(addedMembers);
        sendSystemMessage(
          appUser.PublicKeyBase58Check,
          groupOwnerKey,
          groupName,
          "member-joined",
          addedMembers
        );
      }

      onSuccess();
      handleOpen();
    } catch {
      // Errors already toasted by updateMembers
    } finally {
      setUpdating(false);
    }
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
      const { code, associationId } = await registerInviteCode(
        appUser.PublicKeyBase58Check,
        groupName
      );
      setInviteCode(code);
      setInviteAssociationId(associationId);
      toast.success("Invite link created");
    } catch {
      toast.error("Failed to create invite link");
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
      await navigator.share({ title: `Join ${currentDisplayName}`, url });
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

  // ── Community Listing Handlers ──

  const handleCommunityToggle = async () => {
    if (!appUser || communityToggling) return;
    setCommunityToggling(true);
    const wasListed = isCommunityListed;
    const prevAssociationId = communityAssociationId;
    const prevDescription = communityDescription;

    // Optimistic update
    setIsCommunityListed(!wasListed);

    try {
      if (wasListed && prevAssociationId) {
        await unlistGroupFromCommunity(appUser.PublicKeyBase58Check, prevAssociationId);
        setCommunityAssociationId(null);
        setCommunityDescription("");
        setSavedDescription("");
        clearCommunityCache();
        toast.success("Removed from community directory");
      } else {
        const associationId = await listGroupInCommunity(
          appUser.PublicKeyBase58Check,
          groupName,
          communityDescription
        );
        setCommunityAssociationId(associationId);
        setSavedDescription(communityDescription);
        clearCommunityCache();
        toast.success("Listed in community directory");
      }
    } catch {
      // Rollback
      setIsCommunityListed(wasListed);
      setCommunityAssociationId(prevAssociationId);
      setCommunityDescription(prevDescription);
      setSavedDescription(prevDescription);
      toast.error("Failed to update community listing");
    } finally {
      setCommunityToggling(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!appUser || !communityAssociationId || communitySaving) return;
    if (communityDescription === savedDescription) return;
    setCommunitySaving(true);
    try {
      const newId = await updateCommunityListing(
        appUser.PublicKeyBase58Check,
        communityAssociationId,
        groupName,
        communityDescription
      );
      setCommunityAssociationId(newId);
      setSavedDescription(communityDescription);
      clearCommunityCache();
      toast.success("Description updated");
    } catch {
      toast.error("Failed to update description");
    } finally {
      setCommunitySaving(false);
    }
  };

  // ── Join Request Handlers ──

  const handleApproveRequests = async (keysToApprove: string[]) => {
    if (!appUser || keysToApprove.length === 0 || approvingRef.current) return;
    approvingRef.current = true;

    setApprovingKeys(new Set(keysToApprove));
    try {
      await addMembersAction(groupName, keysToApprove);

      // Remove approved from the join requests list
      const approvedSet = new Set(keysToApprove);
      const approvedRequests = joinRequests.filter((r) => approvedSet.has(r.requesterPublicKey));
      setJoinRequests((prev) =>
        prev.filter((r) => !approvedSet.has(r.requesterPublicKey))
      );
      setSelectedRequests(new Set());
      setJoinRequestBadge((prev) => Math.max(0, prev - keysToApprove.length));
      decrementJoinRequestCount(conversationKey, keysToApprove.length);

      // Optimistically add approved users to the members list
      for (const req of approvedRequests) {
        addMemberDirect({
          id: req.requesterPublicKey,
          text: nameOrFormattedKey(req.profile, req.requesterPublicKey),
          profile: req.profile,
        });
      }

      toast.success(
        keysToApprove.length === 1
          ? "Member approved"
          : `${keysToApprove.length} members approved`
      );

      // Best-effort: send system log message for approved members
      const approvedMembers = approvedRequests.map((r) => ({
        pk: r.requesterPublicKey,
        un: nameOrFormattedKey(r.profile, r.requesterPublicKey),
      }));
      onOptimisticSystemMessage(approvedMembers);
      sendSystemMessage(
        appUser.PublicKeyBase58Check,
        groupOwnerKey,
        groupName,
        "member-joined",
        approvedMembers
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
      approvingRef.current = false;
      setApprovingKeys(new Set());
    }
  };

  const handleRejectRequests = async (keysToReject: string[]) => {
    if (!appUser || keysToReject.length === 0) return;

    const rejectSet = new Set(keysToReject);
    const rejectedRequests = joinRequests.filter((r) =>
      rejectSet.has(r.requesterPublicKey)
    );

    // Optimistic: remove from UI immediately
    setRejectingKeys(new Set(keysToReject));
    setJoinRequests((prev) =>
      prev.filter((r) => !rejectSet.has(r.requesterPublicKey))
    );
    setSelectedRequests(new Set());
    setJoinRequestBadge((prev) => Math.max(0, prev - keysToReject.length));
    decrementJoinRequestCount(conversationKey, keysToReject.length);

    // Create on-chain rejection associations so they stay filtered on reload
    const ownerKey = appUser.PublicKeyBase58Check;
    const results = await Promise.allSettled(
      keysToReject.map((requesterKey) =>
        createRejectAssociation(ownerKey, requesterKey, groupName)
      )
    );

    // Check if any failed and roll back those
    const failedKeys = new Set<string>();
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        failedKeys.add(keysToReject[i]);
      }
    });
    const failedRequests = rejectedRequests.filter((r) =>
      failedKeys.has(r.requesterPublicKey)
    );

    if (failedRequests.length > 0) {
      // Roll back failed rejections
      setJoinRequests((prev) => [...prev, ...failedRequests]);
      setJoinRequestBadge((prev) => prev + failedRequests.length);
      toast.error(
        failedRequests.length === 1
          ? "Failed to reject request"
          : `Failed to reject ${failedRequests.length} requests`
      );
    } else {
      toast.success(
        keysToReject.length === 1
          ? "Request rejected"
          : `${keysToReject.length} requests rejected`
      );
    }

    setRejectingKeys(new Set());
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
        className="text-gray-400 hover:text-[#34F080] bg-transparent p-0 flex items-center cursor-pointer relative overflow-visible transition-colors"
      >
        <span className="relative">
          <Users className="w-5 h-5" />
          {joinRequestBadge > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {joinRequestBadge > 99 ? "99+" : joinRequestBadge}
            </span>
          )}
        </span>
        <span className="hidden items-center md:flex font-medium text-sm ml-1.5">
          Members
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60] modal-backdrop-enter" onClick={() => setOpen(false)} role="presentation" />
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="manage-members-title"
              tabIndex={-1}
              className="bg-[#0c1220] text-white border border-white/8 w-full sm:w-[min(95vw,480px)] rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col outline-none shadow-2xl shadow-black/40 modal-card-enter"
            >
              {/* Sticky header */}
              <div className="text-white p-5 border-b border-white/8 flex-shrink-0">
                <div className="flex justify-between w-full items-center">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {isGroupOwner ? (
                      <GroupImagePicker
                        imageUrl={groupImageUrl}
                        onImageChange={handleGroupImageSave}
                        groupName={currentDisplayName}
                        diameter={56}
                      />
                    ) : (
                      <MessagingDisplayAvatar
                        publicKey={currentDisplayName}
                        groupChat
                        groupImageUrl={currentGroupImageUrl}
                        diameter={56}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {editingName ? (
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={editNameValue}
                          maxLength={64}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGroupNameSave();
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setEditingName(false);
                              setEditNameValue(currentDisplayName);
                            }
                          }}
                          onBlur={handleGroupNameSave}
                          className="text-xl font-semibold bg-white/5 border border-white/10 rounded-md px-2 py-0.5 outline-none text-white w-full"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span
                            id="manage-members-title"
                            className={`text-xl font-semibold truncate ${isGroupOwner ? "cursor-pointer" : ""}`}
                            onClick={isGroupOwner && !savingName ? () => {
                              setEditingName(true);
                              setTimeout(() => nameInputRef.current?.select(), 0);
                            } : undefined}
                          >
                            {savingName ? editNameValue : currentDisplayName}
                          </span>
                          {isGroupOwner && !savingName && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingName(true);
                                setTimeout(() => nameInputRef.current?.select(), 0);
                              }}
                              className="p-1 text-white/30 hover:text-white/60 cursor-pointer shrink-0"
                              aria-label="Rename group"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {savingName && <Loader2 className="w-4 h-4 animate-spin text-white/30 shrink-0" />}
                        </div>
                      )}
                      <div className="text-sm text-white/30">
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
                    className="pl-2 cursor-pointer shrink-0"
                    aria-label="Close dialog"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Invite Link Section (owner only) */}
              {isGroupOwner && (
                <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
                  {inviteCode ? (
                    <div className="space-y-2">
                      <div className="glass-pill rounded-lg px-3 py-2 text-sm text-white/70 truncate font-mono">
                        {buildInviteUrl(inviteCode)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyInviteLink}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg glass-btn-secondary text-gray-300 cursor-pointer"
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
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg glass-btn-secondary text-gray-300 cursor-pointer"
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
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg glass-btn-danger text-red-400 cursor-pointer disabled:opacity-50"
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
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg glass-btn-secondary text-gray-300 text-sm font-medium cursor-pointer disabled:opacity-50"
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

              {/* Community Listing Toggle (owner only, when invite link exists) */}
              {isGroupOwner && inviteCode && (
                <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm text-white/80 font-medium">List in Community</span>
                        <p className="text-xs text-white/25">Let others discover this group</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCommunityToggle}
                      disabled={communityToggling}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[#34F080]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050e1d] ${
                        isCommunityListed ? "bg-[#34F080]" : "bg-white/10"
                      }`}
                      aria-label={isCommunityListed ? "Remove from community directory" : "List in community directory"}
                    >
                      {communityToggling ? (
                        <Loader2 className={`w-3.5 h-3.5 animate-spin absolute top-[5px] text-white ${
                          isCommunityListed ? "right-[5px]" : "left-[5px]"
                        }`} />
                      ) : (
                        <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-transform ${
                          isCommunityListed ? "translate-x-[21px]" : "translate-x-[3px]"
                        }`} />
                      )}
                    </button>
                  </div>

                  {/* Friendly content guideline */}
                  {isCommunityListed && (
                    <p className="mt-2 text-[11px] text-white/25">
                      Community listings are visible to everyone. Please keep your group name and description welcoming and appropriate for all audiences.
                    </p>
                  )}

                  {/* Description field (shown when listed) */}
                  {isCommunityListed && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={communityDescription}
                        onChange={(e) => setCommunityDescription(e.target.value.slice(0, 200))}
                        placeholder="Add a short description..."
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 bg-white/5 border border-white/8 focus:border-white/15 outline-none resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/25">{communityDescription.length}/200</span>
                        {communityDescription !== savedDescription && (
                          <button
                            type="button"
                            onClick={handleSaveDescription}
                            disabled={communitySaving}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg glass-btn-primary text-[#34F080] text-xs font-medium cursor-pointer disabled:opacity-50"
                          >
                            {communitySaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form name="start-group-chat-form" onSubmit={formSubmit} className="flex flex-col min-h-0 flex-1">
                {/* Scrollable body */}
                <div className="p-5 pb-0 overflow-y-auto overflow-x-hidden flex-1 min-h-0 custom-scrollbar">
                  <div className="mb-0">
                    {/* Join Requests Section (owner only) */}
                    {isGroupOwner && joinRequests.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                            <UserPlus className="w-4 h-4" />
                            Join Requests ({joinRequests.length})
                          </span>
                          <div className="flex items-center gap-2">
                            {joinRequests.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={toggleSelectAll}
                                  className="text-xs text-[#34F080]/70 hover:text-[#34F080] cursor-pointer"
                                >
                                  {selectedRequests.size === joinRequests.length
                                    ? "Deselect all"
                                    : "Select all"}
                                </button>
                                {selectedRequests.size > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApproveRequests(
                                          Array.from(selectedRequests)
                                        )
                                      }
                                      disabled={approvingKeys.size > 0}
                                      className="text-xs px-3 py-1 rounded-full glass-btn-primary text-[#34F080] cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {approvingKeys.size > 0 ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <CheckCheck className="w-3 h-3" />
                                      )}
                                      Approve ({selectedRequests.size})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRejectRequests(
                                          Array.from(selectedRequests)
                                        )
                                      }
                                      disabled={rejectingKeys.size > 0}
                                      className="text-xs px-3 py-1 rounded-full glass-btn-danger text-red-400 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {rejectingKeys.size > 0 ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                      Reject ({selectedRequests.size})
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {joinRequests.map((req) => {
                            const username =
                              req.profile?.Username ||
                              req.requesterPublicKey.slice(0, 18) + "...";
                            const isApproving = approvingKeys.has(
                              req.requesterPublicKey
                            );
                            const isRejecting = rejectingKeys.has(
                              req.requesterPublicKey
                            );
                            const isSelected = selectedRequests.has(
                              req.requesterPublicKey
                            );
                            return (
                              <div
                                key={req.requesterPublicKey}
                                className={`flex items-center p-2 md:p-3 rounded-xl border cursor-pointer transition-colors hover:bg-white/[0.06] ${
                                  isSelected
                                    ? "bg-[#34F080]/[0.06] border-[#34F080]/15"
                                    : "bg-white/[0.03] border-white/5"
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
                                        ? "bg-[#34F080]/20 border-[#34F080]/40"
                                        : "border-white/15"
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
                                <div className="ml-2 min-w-0 shrink text-left">
                                  <div className="font-medium text-sm truncate">
                                    {username}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
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
                                      handleRejectRequests([req.requesterPublicKey]);
                                    }}
                                    disabled={isRejecting}
                                    className="rounded-full px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isRejecting ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <X className="w-3 h-3" />
                                    )}
                                    <span className="hidden sm:inline">Reject</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isGroupOwner && joinRequestsLoading && (
                      <div className="flex items-center gap-2 text-sm text-white/30 mb-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking for join requests...
                      </div>
                    )}

                    {isGroupOwner && !joinRequestsLoading && joinRequests.length === 0 && (
                      <div className="text-sm text-white/25 mb-3 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4" />
                        No pending join requests
                      </div>
                    )}

                    {isGroupOwner && (
                      <SearchUsers
                        className="text-white placeholder:text-gray-500 bg-white/5 border-white/8"
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
                      className="mt-3 pr-1"
                      ref={membersAreaRef}
                    >
                      {loading ? (
                        <div className="text-center">
                          <Loader2 className="w-11 h-11 mt-4 animate-spin text-[#34F080] mx-auto" />
                        </div>
                      ) : (
                        members.map((member) => {
                          const memberPresence = getPresence(member.id);
                          return (
                          <div
                            className="grid grid-cols-[auto_1fr_auto] gap-x-2 p-2 md:p-3 items-center cursor-pointer text-white bg-white/[0.03] border border-white/5 rounded-xl my-2"
                            key={member.id}
                          >
                            <MessagingDisplayAvatar
                              username={member.text}
                              publicKey={member.id}
                              diameter={isMobile ? 40 : 50}
                              classNames="mx-0"
                              showOnlineDot={memberPresence.status === "online"}
                            />
                            <div className="min-w-0 text-left">
                              <div className="font-medium truncate">{member.text}</div>
                                {isGroupOwner && currentMemberKeys.includes(member.id) ? (
                                  <div className="text-xs md:text-sm text-white/40 mt-1">
                                    Already in the chat
                                  </div>
                                ) : memberPresence.status === "online" ? (
                                  <div className="text-xs text-[#34F080] mt-0.5">Online</div>
                                ) : memberPresence.status === "last-seen" ? (
                                  <div className="text-xs text-gray-500 mt-0.5">{formatLastSeen(memberPresence.timestamp)}</div>
                                ) : null}
                              </div>
                            {isGroupOwner && member.id !== appUser?.PublicKeyBase58Check ? (
                              <button
                                className="rounded-full px-3 py-2 glass-btn-danger text-red-400 text-sm md:px-4 cursor-pointer"
                                onClick={() => removeMember(member.id)}
                              >
                                Remove
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="flex justify-between p-5 border-t border-white/8 gap-3 flex-shrink-0">
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
                      className="rounded-full py-2 glass-btn-danger text-sm px-4 text-red-400 cursor-pointer flex items-center gap-1.5"
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
                          className="rounded-full py-2 glass-btn-secondary text-sm px-4 text-gray-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="glass-btn-primary text-[#34F080] font-semibold rounded-full py-2 text-sm px-4 flex items-center cursor-pointer transition-colors"
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
