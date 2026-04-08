import {
  createUserAssociation,
  deleteUserAssociation,
  getBulkAccessGroups,
  getPaginatedAccessGroupMembers,
  getUserAssociations,
  ProfileEntryResponse,
} from "deso-protocol";
import { withAuth } from "../utils/with-auth";
import {
  ASSOCIATION_TYPE_COMMUNITY_LISTED,
  ASSOCIATION_TYPE_GROUP_INVITE_CODE,
  CHATON_REGISTRY_PUBLIC_KEY,
  CHATON_SIGNING_PUBLIC_KEY,
} from "../utils/constants";
import { GROUP_DISPLAY_NAME, GROUP_IMAGE_URL } from "../utils/extra-data";

export interface CommunityListing {
  ownerKey: string;
  groupKeyName: string;
  associationId: string;
  description: string;
  ownerProfile: ProfileEntryResponse | null;
}

export interface EnrichedCommunityListing extends CommunityListing {
  groupDisplayName?: string;
  groupImageUrl?: string;
  inviteCode: string | null;
  memberCount: number;
  memberCountCapped: boolean;
}

/**
 * Fetch all community-listed groups from the on-chain registry.
 * Paginates through all `chaton:community-listed` associations targeting
 * CHATON_REGISTRY_PUBLIC_KEY, returning owner profiles via IncludeTransactorProfile.
 */
export async function fetchCommunityListings(): Promise<CommunityListing[]> {
  const results: CommunityListing[] = [];
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: CHATON_REGISTRY_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_COMMUNITY_LISTED,
      IncludeTransactorProfile: true,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    const profileMap = res.PublicKeyToProfileEntryResponse ?? {};

    for (const a of associations) {
      results.push({
        ownerKey: a.TransactorPublicKeyBase58Check,
        groupKeyName: a.AssociationValue,
        associationId: a.AssociationID,
        description: a.ExtraData?.["community:description"] ?? "",
        ownerProfile:
          a.TransactorProfile ??
          profileMap[a.TransactorPublicKeyBase58Check] ??
          null,
      });
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return results;
}

/**
 * List a group in the community directory by creating a `chaton:community-listed`
 * association on-chain. Returns the new association ID.
 */
export async function listGroupInCommunity(
  ownerPublicKey: string,
  groupKeyName: string,
  description = ""
): Promise<string> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: ownerPublicKey,
        TargetUserPublicKeyBase58Check: CHATON_REGISTRY_PUBLIC_KEY,
        AssociationType: ASSOCIATION_TYPE_COMMUNITY_LISTED,
        AssociationValue: groupKeyName,
        ExtraData: {
          "group:keyName": groupKeyName,
          "community:description": description,
        },
      },
      { checkPermissions: false }
    )
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: ownerPublicKey,
    TargetUserPublicKeyBase58Check: CHATON_REGISTRY_PUBLIC_KEY,
    AssociationType: ASSOCIATION_TYPE_COMMUNITY_LISTED,
    AssociationValue: groupKeyName,
    Limit: 1,
  });
  return res.Associations?.[0]?.AssociationID ?? "";
}

/**
 * Remove a group from the community directory by deleting its association.
 */
export async function unlistGroupFromCommunity(
  ownerPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation(
      {
        TransactorPublicKeyBase58Check: ownerPublicKey,
        AssociationID: associationId,
      },
      { checkPermissions: false }
    )
  );
}

/**
 * Check if a specific group is community-listed. Uses direct AssociationValue
 * filter for O(1) lookup instead of pagination. Returns the association ID
 * and description if found, or null.
 */
export async function fetchCommunityListing(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ associationId: string; description: string } | null> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: ownerPublicKey,
      TargetUserPublicKeyBase58Check: CHATON_REGISTRY_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_COMMUNITY_LISTED,
      AssociationValue: groupKeyName,
      Limit: 1,
    });
    const a = res.Associations?.[0];
    if (!a) return null;
    return {
      associationId: a.AssociationID,
      description: a.ExtraData?.["community:description"] ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Update a community listing's description. Creates the new association first,
 * then deletes the old one — safe against partial failure (create-before-delete).
 * If the create succeeds but delete fails, we have a harmless duplicate that
 * the next fetchCommunityListing call will pick up. Returns the new association ID.
 */
export async function updateCommunityListing(
  ownerPublicKey: string,
  oldAssociationId: string,
  groupKeyName: string,
  description: string
): Promise<string> {
  const newId = await listGroupInCommunity(
    ownerPublicKey,
    groupKeyName,
    description
  );
  // Best-effort delete of the old association
  try {
    await unlistGroupFromCommunity(ownerPublicKey, oldAssociationId);
  } catch {
    // Non-fatal: old association will be superseded by the new one
  }
  return newId;
}

/**
 * Enrich community listings with group images, invite codes, and member counts.
 * Fetches data in batches to minimize API calls. Filters out groups with no
 * active invite code (can't join without one).
 */
export async function enrichCommunityListings(
  listings: CommunityListing[]
): Promise<EnrichedCommunityListing[]> {
  if (listings.length === 0) return [];

  // Deduplicate by ownerKey+groupKeyName to avoid redundant API calls
  const uniqueKey = (l: CommunityListing) => l.ownerKey + "|" + l.groupKeyName;
  const seen = new Set<string>();
  const deduped = listings.filter((l) => {
    const k = uniqueKey(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 1. Batch fetch group metadata (images, display names) via getBulkAccessGroups
  //    Also tracks which groups actually exist on-chain to filter out fakes.
  const groupImageMap = new Map<string, string>();
  const groupDisplayNameMap = new Map<string, string>();
  const groupsNotFound = new Set<string>();
  try {
    const groupRes = await getBulkAccessGroups({
      GroupOwnerAndGroupKeyNamePairs: deduped.map((l) => ({
        GroupOwnerPublicKeyBase58Check: l.ownerKey,
        GroupKeyName: l.groupKeyName,
      })),
    });
    const entries = groupRes.AccessGroupEntries ?? [];
    for (const entry of entries) {
      const key =
        entry.AccessGroupOwnerPublicKeyBase58Check +
        "|" +
        entry.AccessGroupKeyName;
      const imageUrl = entry.ExtraData?.[GROUP_IMAGE_URL];
      if (imageUrl) groupImageMap.set(key, imageUrl);
      const displayName = entry.ExtraData?.[GROUP_DISPLAY_NAME];
      if (displayName) groupDisplayNameMap.set(key, displayName);
    }
    // Mark groups that don't exist on-chain so we can exclude them
    for (const pair of groupRes.PairsNotFound ?? []) {
      groupsNotFound.add(
        pair.GroupOwnerPublicKeyBase58Check + "|" + pair.GroupKeyName
      );
    }
  } catch {
    // Non-fatal: cards render without images (but we can't validate existence)
  }

  // 2. Batch-fetch all invite codes signed by ChatOn's key in a single
  //    pagination pass, then build a lookup map. Much more efficient than
  //    per-group queries since all codes share one transactor.
  const inviteCodeMap = new Map<string, string>();
  try {
    let lastId = "";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await getUserAssociations({
        TransactorPublicKeyBase58Check: CHATON_SIGNING_PUBLIC_KEY,
        TargetUserPublicKeyBase58Check: CHATON_REGISTRY_PUBLIC_KEY,
        AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
        Limit: 100,
        ...(lastId ? { LastSeenAssociationID: lastId } : {}),
      });
      const associations = res.Associations ?? [];
      for (const a of associations) {
        const ownerKey = a.ExtraData?.["group:ownerKey"];
        const keyName = a.ExtraData?.["group:keyName"];
        if (ownerKey && keyName) {
          inviteCodeMap.set(ownerKey + "|" + keyName, a.AssociationValue);
        }
      }
      if (associations.length < 100) break;
      lastId = associations[associations.length - 1]!.AssociationID;
    }
  } catch {
    // Non-fatal: groups without matched codes will be filtered out
  }

  // 3. Fetch member counts in parallel (capped at 50 per group)
  const memberCountResults = await Promise.allSettled(
    deduped.map((l) =>
      getPaginatedAccessGroupMembers({
        AccessGroupOwnerPublicKeyBase58Check: l.ownerKey,
        AccessGroupKeyName: l.groupKeyName,
        MaxMembersToFetch: 50,
      })
    )
  );
  const memberCountMap = new Map<string, { count: number; capped: boolean }>();
  deduped.forEach((l, i) => {
    const result = memberCountResults[i]!;
    if (result.status === "fulfilled" && result.value) {
      const members = result.value.AccessGroupMembersBase58Check ?? [];
      const ownerIncluded = members.includes(l.ownerKey);
      memberCountMap.set(uniqueKey(l), {
        count: members.length + (ownerIncluded ? 0 : 1),
        capped: members.length >= 50,
      });
    } else {
      memberCountMap.set(uniqueKey(l), { count: 1, capped: false });
    }
  });

  // 4. Assemble enriched listings, filter out those without invite codes
  return deduped
    .map((l) => {
      const key = uniqueKey(l);
      const memberInfo = memberCountMap.get(key) ?? {
        count: 1,
        capped: false,
      };
      return {
        ...l,
        groupDisplayName: groupDisplayNameMap.get(key),
        groupImageUrl: groupImageMap.get(key),
        inviteCode: inviteCodeMap.get(key) ?? null,
        memberCount: memberInfo.count,
        memberCountCapped: memberInfo.capped,
      };
    })
    .filter(
      (l) =>
        l.inviteCode !== null &&
        !groupsNotFound.has(l.ownerKey + "|" + l.groupKeyName)
    );
}
