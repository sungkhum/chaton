const CACHE_KEY = "chaton:community-cache";

/** Clear the community cache. Call after the user lists/unlists their own group. */
export function clearCommunityCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
