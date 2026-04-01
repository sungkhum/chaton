/**
 * Open Graph metadata fetcher.
 * Fetches the first ~50KB of a page's HTML, extracts OG tags, and returns them.
 * Uses Cloudflare Cache API to avoid re-fetching the same URL within an hour.
 */

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

interface OgResult {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

function parseOgTags(html: string): OgResult {
  const result: OgResult = {};

  // OG tags: <meta property="og:title" content="...">
  const ogRegex = /<meta[^>]*property=["']og:(title|description|image|site_name)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  // Also handle content before property
  const ogRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:(title|description|image|site_name)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = ogRegex.exec(html)) !== null) {
    const key = match[1].toLowerCase().replace("site_name", "siteName") as keyof OgResult;
    if (!result[key]) result[key] = decodeHtmlEntities(match[2]);
  }
  while ((match = ogRegexAlt.exec(html)) !== null) {
    const key = match[2].toLowerCase().replace("site_name", "siteName") as keyof OgResult;
    if (!result[key]) result[key] = decodeHtmlEntities(match[1]);
  }

  // Fallback to <title> if no og:title
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Fallback to meta description if no og:description
  if (!result.description) {
    const descRegex = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i;
    const descRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i;
    const descMatch = html.match(descRegex) || html.match(descRegexAlt);
    if (descMatch) result.description = decodeHtmlEntities(descMatch[1].trim());
  }

  return result;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ChatOnBot/1.0; +https://chaton.app)",
  Accept: "text/html,application/xhtml+xml",
};

/**
 * Fetch a URL following redirects manually so we can check each hop
 * against private IP ranges (prevents SSRF via redirect chains).
 */
async function safeFetch(url: string, signal: AbortSignal): Promise<Response | null> {
  let current = url;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const parsed = new URL(current);
    if (isPrivateHost(parsed.hostname)) return null;

    const res = await fetch(current, {
      signal,
      headers: FETCH_HEADERS,
      redirect: "manual",
    });

    // Not a redirect — return the response
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get("Location");
    if (!location) return res;

    // Resolve relative redirect URLs
    try {
      current = new URL(location, current).href;
    } catch {
      return null;
    }
  }
  return null; // Too many redirects
}

/** Read up to 50KB of a response body, stopping early after </head>. */
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let html = "";
  let bytesRead = 0;
  const MAX_BYTES = 50_000;

  while (bytesRead < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    bytesRead += value.length;
    if (html.includes("</head>")) break;
  }
  reader.cancel();
  return html;
}

export async function handleOgFetch(request: Request): Promise<Response> {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({}, 400);
  }

  const targetUrl = body.url?.trim();
  if (!targetUrl) return jsonResponse({}, 400);

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return jsonResponse({}, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonResponse({}, 400);
  }

  if (isPrivateHost(parsed.hostname)) {
    return jsonResponse({}, 403);
  }

  // Check cache
  const cacheKey = `https://og-cache/${encodeURIComponent(targetUrl)}`;
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Fetch the page
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let html = "";
  try {
    const res = await safeFetch(targetUrl, controller.signal);
    if (!res || !res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      clearTimeout(timeout);
      return cacheAndReturn(cache, cacheKey, {});
    }

    html = await readHead(res);
  } catch {
    clearTimeout(timeout);
    return cacheAndReturn(cache, cacheKey, {});
  }

  clearTimeout(timeout);

  let result = parseOgTags(html);

  // If no OG data found, check for meta http-equiv="refresh" redirect (e.g. Dropbox)
  if (!result.title && !result.description && !result.image) {
    const refreshMatch = html.match(
      /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'\s>]+)["'][^>]*>/i
    );
    if (refreshMatch) {
      let refreshUrl = decodeHtmlEntities(refreshMatch[1]);
      // Resolve relative URLs
      try {
        refreshUrl = new URL(refreshUrl, targetUrl).href;
      } catch {
        // leave as-is if already absolute
      }
      const refreshParsed = new URL(refreshUrl);
      if (!isPrivateHost(refreshParsed.hostname)) {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 5000);
        try {
          const res2 = await safeFetch(refreshUrl, controller2.signal);
          if (res2 && res2.ok && res2.headers.get("content-type")?.includes("text/html")) {
            const html2 = await readHead(res2);
            result = parseOgTags(html2);
          }
        } catch {
          // ignore — return empty result
        }
        clearTimeout(timeout2);
      }
    }
  }

  // Filter out useless Google Docs/Sheets/Slides placeholder titles.
  // These JS-rendered apps return generic titles to bot fetchers.
  const GOOGLE_JUNK_TITLES = [
    "loading google docs", "loading google sheets", "loading google slides",
    "loading google forms", "google docs", "google sheets", "google slides",
    "google forms", "google drive", "error",
  ];
  if (result.title && GOOGLE_JUNK_TITLES.includes(result.title.toLowerCase().trim())) {
    result.title = undefined;
  }

  // If og:title is just the service name (e.g. "Dropbox"), try to extract
  // a real filename from the URL path and use that instead.
  if (result.title && result.siteName &&
      result.title.toLowerCase() === result.siteName.toLowerCase()) {
    const urlFileName = extractFileNameFromUrl(targetUrl);
    if (urlFileName) result.title = urlFileName;
  }

  // Also use URL filename if title matches <title> fallback that's just the domain
  if (!result.title || result.title.toLowerCase() === parsed.hostname.replace(/^www\./, "").toLowerCase()) {
    const urlFileName = extractFileNameFromUrl(targetUrl);
    if (urlFileName) result.title = urlFileName;
  }

  // Don't leak siteName to client — it was only needed for the comparison above
  delete result.siteName;

  return cacheAndReturn(cache, cacheKey, result);
}

/** Extract a meaningful filename from a URL path (e.g. "report.pdf" from a Dropbox/Drive link) */
function extractFileNameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    // Walk backwards to find a segment that looks like a filename (has an extension)
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = decodeURIComponent(segments[i]);
      if (/\.\w{1,10}$/.test(seg) && seg.length > 2) {
        return seg;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function jsonResponse(data: OgResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function cacheAndReturn(
  cache: Cache,
  cacheKey: string,
  data: OgResult
): Promise<Response> {
  const response = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
  // Cache a clone (Response body can only be consumed once)
  await cache.put(cacheKey, response.clone());
  return response;
}
