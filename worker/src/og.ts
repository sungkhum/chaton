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
}

function parseOgTags(html: string): OgResult {
  const result: OgResult = {};

  // OG tags: <meta property="og:title" content="...">
  const ogRegex = /<meta[^>]*property=["']og:(title|description|image)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  // Also handle content before property
  const ogRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:(title|description|image)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = ogRegex.exec(html)) !== null) {
    const key = match[1].toLowerCase() as keyof OgResult;
    if (!result[key]) result[key] = decodeHtmlEntities(match[2]);
  }
  while ((match = ogRegexAlt.exec(html)) !== null) {
    const key = match[2].toLowerCase() as keyof OgResult;
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
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ChatOnBot/1.0; +https://chaton.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      clearTimeout(timeout);
      return cacheAndReturn(cache, cacheKey, {});
    }

    // Read up to 50KB — OG tags are in <head>
    const reader = res.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      return cacheAndReturn(cache, cacheKey, {});
    }

    const decoder = new TextDecoder();
    let bytesRead = 0;
    const MAX_BYTES = 50_000;

    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;
      // Stop early if we've passed </head>
      if (html.includes("</head>")) break;
    }
    reader.cancel();
  } catch {
    clearTimeout(timeout);
    return cacheAndReturn(cache, cacheKey, {});
  }

  clearTimeout(timeout);

  const result = parseOgTags(html);
  return cacheAndReturn(cache, cacheKey, result);
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
