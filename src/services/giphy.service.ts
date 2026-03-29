const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";
const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";

export interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    fixed_width_still: {
      url: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
}

interface GiphyResponse {
  data: GiphyGif[];
}

export async function searchGifs(
  query: string,
  limit = 20,
  offset = 0
): Promise<GiphyGif[]> {
  if (!GIPHY_API_KEY) return [];

  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    q: query,
    limit: String(limit),
    offset: String(offset),
    rating: "pg-13",
    lang: "en",
  });

  const response = await fetch(`${GIPHY_BASE_URL}/search?${params}`);
  if (!response.ok) return [];

  const data: GiphyResponse = await response.json();
  return data.data;
}

export async function trendingGifs(limit = 20): Promise<GiphyGif[]> {
  if (!GIPHY_API_KEY) return [];

  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: String(limit),
    rating: "pg-13",
  });

  const response = await fetch(`${GIPHY_BASE_URL}/trending?${params}`);
  if (!response.ok) return [];

  const data: GiphyResponse = await response.json();
  return data.data;
}
