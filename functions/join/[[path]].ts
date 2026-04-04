/**
 * Cloudflare Pages Function for /join/* routes.
 *
 * Serves the normal index.html (SPA shell) but rewrites OG meta tags
 * so social crawlers (Facebook, Twitter, Slack, Discord, iMessage) see
 * invite-specific previews instead of the generic ChatOn OG tags.
 *
 * Real users get the same index.html with the same JS bundles — the
 * React app handles routing to JoinGroupPage as usual.
 */

const OG_OVERRIDES: Record<string, string> = {
  "og:title": "You're invited to a group on ChatOn",
  "og:description":
    "Join a private, end-to-end encrypted group chat on ChatOn. Messaging that no one can shut down.",
  "og:image": "https://getchaton.com/chaton-invited.webp",
  "og:image:alt": "You're invited — Join a private group on ChatOn",
};

const TWITTER_OVERRIDES: Record<string, string> = {
  "twitter:title": "You're invited to a group on ChatOn",
  "twitter:description":
    "Join a private, end-to-end encrypted group chat. Messaging that no one can shut down.",
  "twitter:image": "https://getchaton.com/chaton-invited.webp",
};

class OGMetaRewriter implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    const property = element.getAttribute("property");
    const name = element.getAttribute("name");

    // Rewrite og:* tags
    if (property && property in OG_OVERRIDES) {
      element.setAttribute("content", OG_OVERRIDES[property]);
    }

    // Rewrite twitter:* tags
    if (name && name in TWITTER_OVERRIDES) {
      element.setAttribute("content", TWITTER_OVERRIDES[name]);
    }
  }
}

class TitleRewriter implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    element.setInnerContent("You're invited to a group on ChatOn");
  }
}

export const onRequest: PagesFunction = async (context) => {
  // Fetch the original index.html from the static asset origin
  const url = new URL(context.request.url);
  url.pathname = "/";
  const response = await context.env.ASSETS.fetch(new Request(url.toString(), context.request));

  // Rewrite OG meta tags on the edge
  return new HTMLRewriter()
    .on("meta[property^=\"og:\"]", new OGMetaRewriter())
    .on("meta[name^=\"twitter:\"]", new OGMetaRewriter())
    .on("title", new TitleRewriter())
    .transform(response);
};
