const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY || "";
const KLIPY_BASE_URL = "https://api.klipy.com/api/v1";

/** A single format variant (e.g. gif, webp, mp4) */
export interface KlipyFormat {
  url: string;
  width: number;
  height: number;
  size: number;
}

/** Size variants available for each item */
export interface KlipyFileSizes {
  hd?: Record<string, KlipyFormat>;
  md?: Record<string, KlipyFormat>;
  sm?: Record<string, KlipyFormat>;
  xs?: Record<string, KlipyFormat>;
}

export interface KlipyItem {
  id: number;
  slug: string;
  title: string;
  file: KlipyFileSizes;
  tags: string[];
  type: string; // "gif" | "sticker" | "ad"
  blur_preview?: string; // base64 data URI for instant placeholder
}

interface KlipyResponse {
  result: boolean;
  data: {
    data: KlipyItem[];
    current_page: number;
    per_page: number;
    has_next: boolean;
  };
}

export interface KlipyCategory {
  slug: string;
  title: string;
}

interface KlipyCategoriesResponse {
  result: boolean;
  data: KlipyCategory[];
}

interface KlipySuggestionsResponse {
  result: boolean;
  data: string[];
}

type ContentType = "gifs" | "stickers";

/** Get the best display URL for an item (prefers webp > gif > mp4) */
export function getDisplayUrl(
  item: KlipyItem,
  size: "hd" | "md" | "sm" | "xs" = "md"
): { url: string; width: number; height: number } | null {
  const sizeData = item.file[size];
  if (!sizeData) return getDisplayUrl(item, size === "sm" ? "md" : "sm");

  const format = sizeData.webp || sizeData.gif || sizeData.mp4;
  if (!format) return null;
  return { url: format.url, width: format.width, height: format.height };
}

/** Get a small thumbnail URL for the picker grid */
export function getThumbnailUrl(item: KlipyItem): {
  url: string;
  width: number;
  height: number;
} | null {
  return getDisplayUrl(item, "sm");
}

/** Get the URL to store in message ExtraData (medium quality gif for compatibility) */
export function getMessageUrl(item: KlipyItem): {
  url: string;
  width: number;
  height: number;
} | null {
  // Prefer md gif for universal compatibility, fall back to webp then mp4
  const md = item.file.md;
  if (md) {
    const format = md.gif || md.webp || md.mp4;
    if (format) return { url: format.url, width: format.width, height: format.height };
  }
  return getDisplayUrl(item, "md");
}

function buildUrl(content: ContentType, action: string, params?: Record<string, string>): string {
  const url = new URL(`${KLIPY_BASE_URL}/${KLIPY_API_KEY}/${content}/${action}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function fetchKlipy<T>(url: string): Promise<T | null> {
  if (!KLIPY_API_KEY) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ── GIF endpoints ──

export async function searchGifs(
  query: string,
  page = 1,
  perPage = 24,
  customerId?: string
): Promise<{ items: KlipyItem[]; hasNext: boolean }> {
  const resp = await fetchKlipy<KlipyResponse>(
    buildUrl("gifs", "search", {
      q: query,
      page: String(page),
      per_page: String(perPage),
      content_filter: "medium",
      ...(customerId ? { customer_id: customerId } : {}),
    })
  );
  if (!resp?.result) return { items: [], hasNext: false };
  return { items: resp.data.data.filter((i) => i.type !== "ad"), hasNext: resp.data.has_next };
}

export async function trendingGifs(
  page = 1,
  perPage = 24,
  customerId?: string
): Promise<{ items: KlipyItem[]; hasNext: boolean }> {
  const resp = await fetchKlipy<KlipyResponse>(
    buildUrl("gifs", "trending", {
      page: String(page),
      per_page: String(perPage),
      ...(customerId ? { customer_id: customerId } : {}),
    })
  );
  if (!resp?.result) return { items: [], hasNext: false };
  return { items: resp.data.data.filter((i) => i.type !== "ad"), hasNext: resp.data.has_next };
}

// ── Sticker endpoints ──

export async function searchStickers(
  query: string,
  page = 1,
  perPage = 24,
  customerId?: string
): Promise<{ items: KlipyItem[]; hasNext: boolean }> {
  const resp = await fetchKlipy<KlipyResponse>(
    buildUrl("stickers", "search", {
      q: query,
      page: String(page),
      per_page: String(perPage),
      content_filter: "medium",
      ...(customerId ? { customer_id: customerId } : {}),
    })
  );
  if (!resp?.result) return { items: [], hasNext: false };
  return { items: resp.data.data.filter((i) => i.type !== "ad"), hasNext: resp.data.has_next };
}

export async function trendingStickers(
  page = 1,
  perPage = 24,
  customerId?: string
): Promise<{ items: KlipyItem[]; hasNext: boolean }> {
  const resp = await fetchKlipy<KlipyResponse>(
    buildUrl("stickers", "trending", {
      page: String(page),
      per_page: String(perPage),
      ...(customerId ? { customer_id: customerId } : {}),
    })
  );
  if (!resp?.result) return { items: [], hasNext: false };
  return { items: resp.data.data.filter((i) => i.type !== "ad"), hasNext: resp.data.has_next };
}

// ── Categories ──

export async function getCategories(
  content: ContentType
): Promise<KlipyCategory[]> {
  const resp = await fetchKlipy<KlipyCategoriesResponse>(
    buildUrl(content, "categories")
  );
  return resp?.result ? resp.data : [];
}

// ── Search suggestions ──

export async function getSearchSuggestions(
  query: string,
  limit = 8
): Promise<string[]> {
  if (!KLIPY_API_KEY || !query.trim()) return [];
  const url = `${KLIPY_BASE_URL}/${KLIPY_API_KEY}/search-suggestions/${encodeURIComponent(query)}?limit=${limit}`;
  const resp = await fetchKlipy<KlipySuggestionsResponse>(url);
  return resp?.result ? resp.data : [];
}

// ── Share tracking (call when user sends a GIF/sticker) ──

export function trackShare(content: ContentType, slug: string): void {
  if (!KLIPY_API_KEY) return;
  // Fire-and-forget POST
  fetch(buildUrl(content, `share/${slug}`), { method: "POST" }).catch(() => {});
}
