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
  CHATON_DONATION_PUBLIC_KEY,
} from "../utils/constants";
import { GROUP_IMAGE_URL } from "../utils/extra-data";

export interface CommunityListing {
  ownerKey: string;
  groupKeyName: string;
  associationId: string;
  description: string;
  ownerProfile: ProfileEntryResponse | null;
}

export interface EnrichedCommunityListing extends CommunityListing {
  groupImageUrl?: string;
  inviteCode: string | null;
  memberCount: number;
  memberCountCapped: boolean;
}

/**
 * Fetch all community-listed groups from the on-chain registry.
 * Paginates through all `chaton:community-listed` associations targeting
 * CHATON_DONATION_PUBLIC_KEY, returning owner profiles via IncludeTransactorProfile.
 */
export async function fetchCommunityListings(): Promise<CommunityListing[]> {
  const results: CommunityListing[] = [];
  let lastId = "";

  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
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
    lastId = associations[associations.length - 1].AssociationID;
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
        TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
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
    TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
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
 * Check if a specific group is community-listed. Returns the association ID
 * and description if found, or null.
 */
export async function fetchCommunityListing(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ associationId: string; description: string } | null> {
  let lastId = "";
  const maxPages = 10;

  for (let page = 0; page < maxPages; page++) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: ownerPublicKey,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_COMMUNITY_LISTED,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      if (a.AssociationValue === groupKeyName) {
        return {
          associationId: a.AssociationID,
          description: a.ExtraData?.["community:description"] ?? "",
        };
      }
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }
  return null;
}

/**
 * Update a community listing's description by deleting and recreating the
 * association (DeSo associations are immutable). Returns the new association ID.
 */
export async function updateCommunityListing(
  ownerPublicKey: string,
  associationId: string,
  groupKeyName: string,
  description: string
): Promise<string> {
  await unlistGroupFromCommunity(ownerPublicKey, associationId);
  return listGroupInCommunity(ownerPublicKey, groupKeyName, description);
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

  // 1. Batch fetch group metadata (images) via getBulkAccessGroups
  let groupImageMap = new Map<string, string>();
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
    }
  } catch {
    // Non-fatal: cards render without images
  }

  // 2. Fetch all invite codes from registry and match to listings client-side
  const inviteCodeMap = new Map<string, string>(); // ownerKey|groupKeyName → code
  try {
    let lastId = "";
    while (true) {
      const res = await getUserAssociations({
        TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
        AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
        Limit: 100,
        ...(lastId ? { LastSeenAssociationID: lastId } : {}),
      });

      const associations = res.Associations ?? [];
      for (const a of associations) {
        const groupKeyName = a.ExtraData?.["group:keyName"];
        if (groupKeyName) {
          const key = a.TransactorPublicKeyBase58Check + "|" + groupKeyName;
          inviteCodeMap.set(key, a.AssociationValue);
        }
      }

      if (associations.length < 100) break;
      lastId = associations[associations.length - 1].AssociationID;
    }
  } catch {
    // Non-fatal: listings without invite codes will be filtered out
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
    const result = memberCountResults[i];
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
        groupImageUrl: groupImageMap.get(key),
        inviteCode: inviteCodeMap.get(key) ?? null,
        memberCount: memberInfo.count,
        memberCountCapped: memberInfo.capped,
      };
    })
    .filter((l) => l.inviteCode !== null);
}
