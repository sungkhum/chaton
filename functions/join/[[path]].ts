/**
 * Cloudflare Pages Function for /join/* routes.
 *
 * Resolves the invite code via the DeSo API at the edge, fetches the
 * group's display name, and rewrites OG meta tags so social crawlers
 * (Facebook, Twitter, Slack, Discord, iMessage) see group-specific
 * previews like "Join DeSo Developers — ChatOn".
 *
 * Falls back to generic invite text if the API call fails or times out.
 *
 * Real users get the same index.html with the same JS bundles — the
 * React app handles routing to JoinGroupPage as usual.
 */

const DESO_NODE = "https://node.deso.org";
const CHATON_SIGNING_KEY =
  "BC1YLg2qBgxVDcK8pAgSEAJbizmHDRDExTaYS9xzEH5ZMhVxKsxTVZr";
const CHATON_REGISTRY_KEY =
  "BC1YLibU7KwQRTnWJ3nDyVzitNFdyDa28LjZDEnH5Y6xP9oHa59J5xK";
const INVITE_ASSOCIATION_TYPE = "chaton:group-invite-code";
const DEFAULT_OG_IMAGE = "https://getchaton.com/chaton-invited.webp";
const RESOLVE_TIMEOUT_MS = 3000;

interface GroupMeta {
  name: string;
  imageUrl?: string;
}

/** Race a promise against a timeout. Returns null if the timeout fires first. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Resolve an invite code to a group name (and optional image) via the
 * DeSo blockchain API. Two sequential fetches:
 *   1. Look up the invite-code association → owner key + group key name
 *   2. Fetch the access group entry → display name + image URL
 */
async function resolveGroupMeta(code: string): Promise<GroupMeta | null> {
  // 1. Resolve invite code → owner + group key name
  const assocRes = await fetch(`${DESO_NODE}/api/v0/user-associations/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TransactorPublicKeyBase58Check: CHATON_SIGNING_KEY,
      TargetUserPublicKeyBase58Check: CHATON_REGISTRY_KEY,
      AssociationType: INVITE_ASSOCIATION_TYPE,
      AssociationValue: code,
      Limit: 1,
    }),
  });

  if (!assocRes.ok) return null;
  const assocData: any = await assocRes.json();
  const assoc = assocData.Associations?.[0];
  if (!assoc) return null;

  const ownerKey: string | undefined = assoc.ExtraData?.["group:ownerKey"];
  const groupKeyName: string | undefined = assoc.ExtraData?.["group:keyName"];
  if (!ownerKey || !groupKeyName) return null;

  // 2. Fetch group entry for display name + image
  const groupRes = await fetch(`${DESO_NODE}/api/v0/get-bulk-access-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      GroupOwnerAndGroupKeyNamePairs: [
        {
          GroupOwnerPublicKeyBase58Check: ownerKey,
          GroupKeyName: groupKeyName,
        },
      ],
    }),
  });

  if (!groupRes.ok) return null;
  const groupData: any = await groupRes.json();
  if (groupData.PairsNotFound?.length) return null;

  const entry = groupData.AccessGroupEntries?.[0];
  const displayName: string | undefined =
    entry?.ExtraData?.["group:displayName"];
  const imageUrl: string | undefined = entry?.ExtraData?.["group:imageUrl"];

  // Fall back to the key name (strip null bytes) or a generic label
  const name =
    displayName || groupKeyName?.replace(/\0/g, "").trim() || "a group";

  return { name, imageUrl: imageUrl || undefined };
}

function buildOGValues(group: GroupMeta | null) {
  if (group) {
    const title = `You're invited to ${group.name} — ChatOn`;
    const description = `You're invited to join ${group.name} on ChatOn — end-to-end encrypted, decentralized, and free.`;
    const image = group.imageUrl || DEFAULT_OG_IMAGE;
    return { title, description, image };
  }
  return {
    title: "You're invited to a private group — ChatOn",
    description:
      "You're invited to join a private, end-to-end encrypted group chat on ChatOn. Messaging that no one can shut down.",
    image: DEFAULT_OG_IMAGE,
  };
}

class OGMetaRewriter implements HTMLRewriterElementContentHandlers {
  private og: ReturnType<typeof buildOGValues>;
  constructor(og: ReturnType<typeof buildOGValues>) {
    this.og = og;
  }

  element(element: Element) {
    const property = element.getAttribute("property");
    const name = element.getAttribute("name");

    if (property === "og:title") element.setAttribute("content", this.og.title);
    if (property === "og:description")
      element.setAttribute("content", this.og.description);
    if (property === "og:image") element.setAttribute("content", this.og.image);
    if (property === "og:image:alt")
      element.setAttribute("content", this.og.title);

    if (name === "description")
      element.setAttribute("content", this.og.description);
    if (name === "twitter:title")
      element.setAttribute("content", this.og.title);
    if (name === "twitter:description")
      element.setAttribute("content", this.og.description);
    if (name === "twitter:image")
      element.setAttribute("content", this.og.image);
  }
}

class TitleRewriter implements HTMLRewriterElementContentHandlers {
  private title: string;
  constructor(title: string) {
    this.title = title;
  }
  element(element: Element) {
    element.setInnerContent(this.title);
  }
}

export const onRequest: PagesFunction = async (context) => {
  // Extract invite code from the path (e.g. /join/k7Xm2p → k7Xm2p)
  const url = new URL(context.request.url);
  const match = url.pathname.match(/^\/join\/([A-Za-z0-9]+)$/);
  const code = match?.[1];

  // Resolve group name from DeSo (with timeout fallback)
  let group: GroupMeta | null = null;
  if (code) {
    try {
      group = await withTimeout(resolveGroupMeta(code), RESOLVE_TIMEOUT_MS);
    } catch {
      // Fall through to generic OG values
    }
  }

  const og = buildOGValues(group);

  // Fetch the SPA index.html from static assets
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = "/";
  const response = await context.env.ASSETS.fetch(
    new Request(assetUrl.toString(), context.request)
  );

  // Rewrite OG meta tags on the edge
  return new HTMLRewriter()
    .on("meta", new OGMetaRewriter(og))
    .on("title", new TitleRewriter(og.title))
    .transform(response);
};
