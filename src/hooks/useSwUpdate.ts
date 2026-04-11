import { useCallback, useEffect, useState } from "react";

/**
 * Detects when a new service worker has activated and provides a callback
 * to reload the page. Works with `skipWaiting: true` in the SW — the new
 * SW activates immediately, so we detect the controller change rather than
 * waiting for a "waiting" state.
 *
 * Only shows the update banner when a DIFFERENT SW takes control of an
 * already-controlled page. First-ever SW registration (null → controller)
 * is not treated as an "update" — this prevents a misleading banner on
 * first visit or after stale-chunk recovery clears all SWs.
 */
export function useSwUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // Capture the controller at the time the hook mounts.
    // If null (first visit, post-cache-clear), the first controllerchange
    // is the initial registration — not an update.
    const initialController = navigator.serviceWorker.controller;

    const onControllerChange = () => {
      if (!cancelled && initialController !== null) {
        setUpdateAvailable(true);
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    // With skipWaiting: true, the new SW is already active — just reload.
    window.location.reload();
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate };
}
