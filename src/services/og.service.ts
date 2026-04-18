export interface OgData {
  title?: string;
  description?: string;
  image?: string;
  // Tweet-specific fields (from fxtwitter)
  type?: "tweet" | "reddit" | "youtube";
  author?: string;
  authorHandle?: string;
  authorAvatar?: string;
  metrics?: { replies?: number; retweets?: number; likes?: number };
  // Reddit-specific fields
  subreddit?: string;
  score?: number;
  numComments?: number;
  // YouTube-specific fields
  videoId?: string;
}

const RELAY_URL = (import.meta.env.VITE_RELAY_URL || "").replace(
  /^wss?:\/\//,
  "https://"
);

// In-memory cache to avoid duplicate fetches within a session
const cache = new Map<string, OgData>();

export async function fetchOgData(url: string): Promise<OgData> {
  if (cache.has(url)) return cache.get(url)!;
  if (!RELAY_URL) return {};

  try {
    const res = await fetch(`${RELAY_URL}/og`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return {};
    const data: OgData = await res.json();
    cache.set(url, data);
    return data;
  } catch {
    return {};
  }
}
