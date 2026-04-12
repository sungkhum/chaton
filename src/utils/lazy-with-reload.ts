import { lazy } from "react";

const RELOAD_KEY = "chaton:chunk-reload";

/** True if the error looks like a stale/missing chunk after a deployment. */
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || "";
  return (
    msg.includes("Loading chunk") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Failed to fetch") ||
    msg.includes("MIME type") ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Like React.lazy(), but auto-reloads the page once on stale-chunk errors
 * (e.g. after a deploy with new hashes). While the reload is in-flight,
 * returns a never-resolving promise so React keeps showing the Suspense
 * spinner instead of flashing the error boundary.
 *
 * A sessionStorage timestamp prevents infinite reload loops — if we already
 * reloaded within the last 30 s, the error propagates normally to the error
 * boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() =>
    importFn().catch((error) => {
      if (isChunkLoadError(error)) {
        const lastReload = sessionStorage.getItem(RELOAD_KEY);
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(now));
          window.location.reload();
          // Never resolve — keep Suspense spinner visible until the reload
          return new Promise<never>(() => {});
        }
      }
      throw error;
    })
  );
}
