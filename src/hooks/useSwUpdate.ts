import { useCallback, useEffect, useState } from "react";

/**
 * Detects when a new service worker is waiting to activate and provides
 * a callback to trigger the update. Used with `skipWaiting: false` in the SW
 * so users are notified before being force-updated mid-conversation.
 */
export function useSwUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function listen() {
      const { getSerwist } = await import("virtual:serwist");
      const serwist = await getSerwist();
      if (!serwist || cancelled) return;

      serwist.addEventListener("waiting", () => {
        if (!cancelled) setUpdateAvailable(true);
      });

      // Also check if there's already a waiting SW (e.g., page opened after
      // the new SW installed in a background tab)
      await serwist.register();
    }

    listen();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    // Tell the waiting SW to activate
    navigator.serviceWorker.ready.then((registration) => {
      registration.waiting?.postMessage({ type: "skip-waiting" });
    });
    // Reload once the new SW takes over
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.location.reload();
      },
      { once: true }
    );
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate };
}
