import { useCallback, useRef } from "react";
import { useStore } from "../store";
import { fetchDesoActivity } from "../services/deso-activity.service";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

export type PresenceStatus =
  | { status: "online" }
  | { status: "last-seen"; timestamp: string; source: "chattra" | "deso" }
  | { status: "unknown" };

// Module-level caches to avoid re-fetching within a session
const fetchedFromD1 = new Set<string>();
const fetchedFromDeso = new Set<string>();

let pendingD1Keys = new Set<string>();
let d1Timer: ReturnType<typeof setTimeout> | null = null;

let pendingDesoKeys = new Set<string>();
let desoTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Batched + debounced fetch of last-seen from the relay D1 endpoint.
 * Collects keys over a 100ms window, then fires one request.
 */
function scheduleD1Fetch(
  keys: string[],
  mergeLastSeen: (data: Record<string, string>) => void,
  mergeDesoActivity: (data: Record<string, string>) => void
) {
  for (const k of keys) {
    if (!fetchedFromD1.has(k)) pendingD1Keys.add(k);
  }
  if (pendingD1Keys.size === 0) return;

  if (d1Timer) clearTimeout(d1Timer);
  d1Timer = setTimeout(async () => {
    const batch = [...pendingD1Keys];
    pendingD1Keys = new Set();
    d1Timer = null;

    for (const k of batch) fetchedFromD1.add(k);

    if (!RELAY_URL) return;

    try {
      const res = await fetch(`${RELAY_URL}/presence/last-seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKeys: batch }),
      });
      if (!res.ok) return;
      const { lastSeen } = (await res.json()) as {
        lastSeen: Record<string, string>;
      };
      if (Object.keys(lastSeen).length > 0) {
        mergeLastSeen(lastSeen);
      }

      // For keys that D1 didn't have data for, fall back to DeSo GraphQL
      const missing = batch.filter((k) => !lastSeen[k]);
      if (missing.length > 0) {
        scheduleDesoFetch(missing, mergeDesoActivity);
      }
    } catch {
      // Best-effort
    }
  }, 100);
}

/**
 * Batched + debounced fetch of last activity from DeSo GraphQL.
 * Collects keys over a 300ms window, then fires one request.
 */
function scheduleDesoFetch(
  keys: string[],
  mergeDesoActivity: (data: Record<string, string>) => void
) {
  for (const k of keys) {
    if (!fetchedFromDeso.has(k)) pendingDesoKeys.add(k);
  }
  if (pendingDesoKeys.size === 0) return;

  if (desoTimer) clearTimeout(desoTimer);
  desoTimer = setTimeout(async () => {
    const batch = [...pendingDesoKeys];
    pendingDesoKeys = new Set();
    desoTimer = null;

    for (const k of batch) fetchedFromDeso.add(k);

    try {
      const data = await fetchDesoActivity(batch);
      if (Object.keys(data).length > 0) {
        mergeDesoActivity(data);
      }
    } catch {
      // Best-effort
    }
  }, 300);
}

export function usePresence() {
  const onlineUsers = useStore((s) => s.onlineUsers);
  const lastSeenByUser = useStore((s) => s.lastSeenByUser);
  const desoActivityByUser = useStore((s) => s.desoActivityByUser);
  const mergeLastSeen = useStore((s) => s.mergeLastSeen);
  const mergeDesoActivity = useStore((s) => s.mergeDesoActivity);

  // Use refs so callbacks don't cause re-renders
  const mergeLastSeenRef = useRef(mergeLastSeen);
  mergeLastSeenRef.current = mergeLastSeen;
  const mergeDesoActivityRef = useRef(mergeDesoActivity);
  mergeDesoActivityRef.current = mergeDesoActivity;

  const getPresence = useCallback(
    (publicKey: string): PresenceStatus => {
      if (onlineUsers.has(publicKey)) return { status: "online" };

      const chattraTs = lastSeenByUser.get(publicKey);
      if (chattraTs) {
        return { status: "last-seen", timestamp: chattraTs, source: "chattra" };
      }

      const desoTs = desoActivityByUser.get(publicKey);
      if (desoTs) {
        return { status: "last-seen", timestamp: desoTs, source: "deso" };
      }

      return { status: "unknown" };
    },
    [onlineUsers, lastSeenByUser, desoActivityByUser]
  );

  const myPublicKey = useStore((s) => s.appUser?.PublicKeyBase58Check ?? "");

  const getOnlineCount = useCallback(
    (publicKeys: string[]): number => {
      let count = 0;
      for (const pk of publicKeys) {
        if (pk !== myPublicKey && onlineUsers.has(pk)) count++;
      }
      return count;
    },
    [onlineUsers, myPublicKey]
  );

  const fetchPresenceForKeys = useCallback(
    (publicKeys: string[]) => {
      // Filter out users already known to be online
      const keysToFetch = publicKeys.filter((pk) => !onlineUsers.has(pk));
      if (keysToFetch.length === 0) return;

      scheduleD1Fetch(
        keysToFetch,
        mergeLastSeenRef.current,
        mergeDesoActivityRef.current
      );
    },
    [onlineUsers]
  );

  return { getPresence, getOnlineCount, fetchPresenceForKeys };
}
