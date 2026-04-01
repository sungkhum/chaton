import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { identity } from "deso-protocol";
import { useStore } from "../store";
import {
  isPushSupported,
  getNotificationPermission,
  requestPushPermission,
  subscribeToPush,
  getExistingSubscription,
  unsubscribeFromPush,
} from "../utils/push-notifications";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

type PushState = "enabled" | "disabled" | "denied" | "unsupported";

function getPrefKey(publicKey: string) {
  return `chaton:push-enabled:${publicKey}`;
}

/** Register a push subscription with the relay server. Best-effort, no throw. */
async function registerWithServer(publicKey: string, subscription: PushSubscription) {
  if (!RELAY_URL) {
    console.warn("[push] No RELAY_URL configured, skipping server registration");
    return;
  }
  try {
    console.log("[push] Registering subscription with server...");
    const jwt = await identity.jwt();
    const res = await fetch(`${RELAY_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, jwt, subscription: subscription.toJSON() }),
    });
    console.log("[push] Server registration response:", res.status);
  } catch (err) {
    console.error("[push] Server registration failed:", err);
  }
}

/** Unregister a push subscription from the relay server. Best-effort, no throw. */
async function unregisterFromServer(publicKey: string, endpoint: string) {
  if (!RELAY_URL) return;
  try {
    const jwt = await identity.jwt();
    await fetch(`${RELAY_URL}/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, endpoint, jwt }),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Ensure a push subscription exists and is registered with the server.
 * Runs silently in the background — never surfaces errors to the user.
 */
async function ensureSubscription(publicKey: string) {
  try {
    console.log("[push] ensureSubscription: checking existing...");
    let sub = await getExistingSubscription();
    if (!sub) {
      console.log("[push] ensureSubscription: no existing, creating...");
      sub = await subscribeToPush();
    }
    if (sub) {
      await registerWithServer(publicKey, sub);
    } else {
      console.warn("[push] ensureSubscription: no subscription obtained");
    }
  } catch (err) {
    console.error("[push] ensureSubscription failed:", err);
  }
}

export function NotificationToggle() {
  const { appUser } = useStore();
  const [pushState, setPushState] = useState<PushState>("disabled");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Derive toggle state synchronously from permission + localStorage preference.
  // Subscription is an implementation detail managed in the background.
  const syncPushState = useCallback(() => {
    if (!appUser) return;

    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }

    const permission = getNotificationPermission();
    if (permission === "denied") {
      setPushState("denied");
      return;
    }

    const pref = localStorage.getItem(getPrefKey(appUser.PublicKeyBase58Check));

    if (permission === "granted" && pref !== "false") {
      setPushState("enabled");
      // Ensure subscription exists in the background (no UI impact)
      ensureSubscription(appUser.PublicKeyBase58Check);
    } else {
      setPushState("disabled");
    }
  }, [appUser]);

  // Run on mount
  useEffect(() => {
    syncPushState();
  }, [syncPushState]);

  // advanced-event-handler-refs: stable listener, no re-registration when syncPushState changes
  const syncPushStateRef = useRef(syncPushState);
  syncPushStateRef.current = syncPushState;

  // Re-sync when page becomes visible (handles iOS resuming after permission dialog)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncPushStateRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const enable = useCallback(async () => {
    if (!appUser || loading) return;
    setLoading(true);

    try {
      const permission = getNotificationPermission();

      if (permission === "denied") {
        setPushState("denied");
        toast.error("Notifications are blocked. Enable them in your browser or device settings.");
        return;
      }

      // Request permission if not yet granted
      if (permission !== "granted") {
        const granted = await requestPushPermission();
        if (!mountedRef.current) return;

        if (!granted) {
          const updated = getNotificationPermission();
          if (updated === "denied") {
            setPushState("denied");
            toast.error("Notifications blocked. You can re-enable them in your browser settings.");
          }
          return;
        }
      }

      // Optimistically show enabled — permission is granted at this point
      setPushState("enabled");
      localStorage.setItem(getPrefKey(appUser.PublicKeyBase58Check), "true");

      // Subscribe + register in the background
      const subscription = await subscribeToPush();
      if (!mountedRef.current) return;

      if (subscription) {
        await registerWithServer(appUser.PublicKeyBase58Check, subscription);
      }

      toast.success("Notifications enabled");
    } catch {
      if (mountedRef.current) {
        toast.error("Failed to enable notifications.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [appUser, loading]);

  const disable = useCallback(async () => {
    if (!appUser || loading) return;
    setLoading(true);

    // Optimistically show disabled
    const prevState = pushState;
    setPushState("disabled");
    localStorage.setItem(getPrefKey(appUser.PublicKeyBase58Check), "false");

    try {
      const subscription = await getExistingSubscription();
      const endpoint = subscription?.endpoint;

      await unsubscribeFromPush();

      if (endpoint) {
        await unregisterFromServer(appUser.PublicKeyBase58Check, endpoint);
      }

      if (mountedRef.current) {
        toast.success("Notifications disabled");
      }
    } catch {
      if (mountedRef.current) {
        // Rollback
        setPushState(prevState);
        localStorage.setItem(getPrefKey(appUser.PublicKeyBase58Check), "true");
        toast.error("Failed to disable notifications.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [appUser, loading, pushState]);

  if (!appUser || pushState === "unsupported") return null;

  const isDenied = pushState === "denied";
  const toggle = pushState === "enabled" ? disable : enable;

  return (
    <button
      onClick={isDenied ? undefined : toggle}
      disabled={loading || isDenied}
      className={`flex items-center justify-between w-full pt-[9px] pb-2 px-3 rounded-md transition-colors disabled:opacity-50 ${
        isDenied
          ? "text-gray-500 cursor-not-allowed"
          : "text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer"
      }`}
      title={isDenied ? "Notifications are blocked in your browser settings" : undefined}
    >
      <div className="flex items-center">
        {pushState === "enabled" ? (
          <BellRing className="mr-3 w-5 h-5 text-[#34F080]" />
        ) : pushState === "denied" ? (
          <BellOff className="mr-3 w-5 h-5 text-red-400" />
        ) : (
          <Bell className="mr-3 w-5 h-5" />
        )}
        <span className="text-base">Notifications</span>
      </div>

      {pushState === "denied" ? (
        <span className="text-xs text-red-400">Blocked</span>
      ) : (
        <div
          className={`w-9 h-5 rounded-full transition-colors relative ${
            pushState === "enabled" ? "bg-[#34F080]" : "bg-white/20"
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              pushState === "enabled" ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      )}
    </button>
  );
}
