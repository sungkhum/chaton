import { useStore } from "../store";
import {
  getBulkAccessGroups,
  getPaginatedAccessGroupMembers,
  getUsersStateless,
} from "deso-protocol";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN,
  MAX_MEMBERS_TO_REQUEST_IN_GROUP,
} from "utils/constants";
import { nameOrFormattedKey, SearchMenuItem } from "../components/search-users";
import { Conversation } from "../utils/types";

export function useMembers(
  setLoading: (l: boolean) => void,
  open: boolean,
  conversation?: Conversation
) {
  const { appUser } = useStore();
  const [members, setMembers] = useState<Array<SearchMenuItem>>([]);
  const [currentMemberKeys, setCurrentMemberKeys] = useState<Array<string>>([]);

  useEffect(() => {
    if (!appUser) {
      toast.error("You must be logged in to view members");
      return;
    }

    if (!open) {
      setMembers([]);
      return;
    }

    if (!conversation) return;

    let cancelled = false;
    setLoading(true);

    const ownerKey = conversation.messages[0].RecipientInfo.OwnerPublicKeyBase58Check;

    getPaginatedAccessGroupMembers({
      AccessGroupOwnerPublicKeyBase58Check: ownerKey,
      AccessGroupKeyName:
        conversation.messages[0].RecipientInfo.AccessGroupKeyName,
      MaxMembersToFetch:
        MAX_MEMBERS_TO_REQUEST_IN_GROUP + MAX_MEMBERS_IN_GROUP_SUMMARY_SHOWN,
    })
      .then(async (res) => {
        if (cancelled) return;
        const memberKeys = res.AccessGroupMembersBase58Check ?? [];
        const profiles = res.PublicKeyToProfileEntryResponse;

        // The members API doesn't include the group owner — fetch their
        // profile and insert them if missing.
        if (!memberKeys.includes(ownerKey)) {
          memberKeys.push(ownerKey);
          if (!profiles[ownerKey]) {
            try {
              const ownerRes = await getUsersStateless({
                PublicKeysBase58Check: [ownerKey],
                SkipForLeaderboard: true,
              });
              if (cancelled) return;
              const ownerProfile = ownerRes.UserList?.[0]?.ProfileEntryResponse;
              if (ownerProfile) profiles[ownerKey] = ownerProfile;
            } catch {
              // Non-fatal — will show formatted key as fallback
            }
          }
        }

        if (cancelled) return;

        // Sort: owner first, then current user, then everyone else
        const isOwner = appUser.PublicKeyBase58Check === ownerKey;
        const sorted = [ownerKey];
        if (!isOwner) {
          const myIdx = memberKeys.indexOf(appUser.PublicKeyBase58Check);
          if (myIdx !== -1) sorted.push(appUser.PublicKeyBase58Check);
        }
        for (const pk of memberKeys) {
          if (!sorted.includes(pk)) sorted.push(pk);
        }

        setCurrentMemberKeys(sorted);
        setMembers(
          sorted.map((publicKey) => ({
            id: publicKey,
            profile: profiles[publicKey] ?? null,
            text: nameOrFormattedKey(profiles[publicKey], publicKey),
          }))
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, appUser]);

  const onPairMissing = () => {
    return toast.error(
      "This user hasn't registered a messaging key on-chain yet." +
        "\nYou can DM them now, but you can't add them to a group chat until they do this.",
      { duration: 10000 }
    );
  };

  const addMember = async (
    member: SearchMenuItem | null,
    onAdded?: () => void
  ) => {
    if (!member || members.find((e) => e.id === member.id)) {
      // do not add member if already added
      return;
    }

    try {
      const { PairsNotFound } = await getBulkAccessGroups({
        GroupOwnerAndGroupKeyNamePairs: [
          {
            GroupOwnerPublicKeyBase58Check: member.id,
            GroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          },
        ],
      });

      if ((PairsNotFound || []).length > 0) {
        onPairMissing();
        return Promise.reject();
      }

      setMembers((state) => [...state, member]);
      onAdded && onAdded();
    } catch (err: any) {
      toast.error(
        `Cannot validate the selected user.\nError: ${err.toString()}`
      );
    }
  };

  const removeMember = (id: string) => {
    setMembers((state) => state.filter((e) => e.id !== id));
  };

  /** Add a member directly without validation — for use after on-chain approval. */
  const addMemberDirect = (member: SearchMenuItem) => {
    if (members.find((e) => e.id === member.id)) return;
    setMembers((state) => [...state, member]);
    setCurrentMemberKeys((state) => [...state, member.id]);
  };

  return {
    members,
    addMember,
    addMemberDirect,
    removeMember,
    onPairMissing,
    currentMemberKeys,
  };
}
