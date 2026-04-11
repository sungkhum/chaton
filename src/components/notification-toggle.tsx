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
} from "../utils/push-notifications";
import { cachePushPublicKey } from "../services/cache.service";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

type PushState = "enabled" | "disabled" | "denied" | "unsupported";

function getPrefKey(publicKey: string) {
  return `chaton:push-enabled:${publicKey}`;
}

/** Register a push subscription with the relay server. Best-effort, no throw. */
async function registerWithServer(
  publicKey: string,
  subscription: PushSubscription
) {
  // Persist public key to IDB so the service worker can re-register
  // the subscription during pushsubscriptionchange (when no client is open).
  cachePushPublicKey(publicKey);

  if (!RELAY_URL) {
    console.warn(
      "[push] No RELAY_URL configured, skipping server registration"
    );
    return;
  }
  try {
    console.log("[push] Registering subscription with server...");
    const jwt = await identity.jwt();
    const res = await fetch(`${RELAY_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        jwt,
        subscription: subscription.toJSON(),
      }),
    });
    console.log("[push] Server registration response:", res.status);
  } catch (err) {
    console.error("[push] Server registration failed:", err);
  }
}

/** Disable push on the server (sets push_enabled=0). Preserves browser subscription
 *  so re-enabling doesn't require a fresh user gesture (critical for iOS). */
async function disableOnServer(publicKey: string) {
  if (!RELAY_URL) return;
  try {
    const jwt = await identity.jwt();
    await fetch(`${RELAY_URL}/push/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, jwt }),
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
    // Always call subscribeToPush() which calls pushManager.subscribe() directly.
    // This is idempotent — returns the existing subscription if valid, or creates
    // a new one if the old one expired (critical for iOS where subscriptions
    // silently expire after ~1-2 weeks of inactivity).
    const sub = await subscribeToPush();
    if (sub) {
      await registerWithServer(publicKey, sub);
    } else {
      console.warn("[push] ensureSubscription: no subscription obtained");
    }
  } catch (err) {
    console.error("[push] ensureSubscription failed:", err);
  }
}

export function NotificationToggle({
  menuItemRole,
}: { menuItemRole?: boolean } = {}) {
  const appUser = useStore((s) => s.appUser);
  const [pushState, setPushState] = useState<PushState>("disabled");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const enable = useCallback(async () => {
    if (!appUser || loading) return;
    setLoading(true);

    try {
      const permission = getNotificationPermission();

      if (permission === "denied") {
        setPushState("denied");
        toast.error(
          "Notifications are blocked. Enable them in your browser or device settings."
        );
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
            toast.error(
              "Notifications blocked. You can re-enable them in your browser settings."
            );
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
      // Server-side disable only — don't call browser unsubscribe().
      // Preserving the browser subscription avoids iOS requiring a fresh
      // user gesture to re-subscribe when the user re-enables notifications.
      await disableOnServer(appUser.PublicKeyBase58Check);

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
      {...(menuItemRole ? { role: "menuitem" as const } : {})}
      className={`flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 ${
        isDenied
          ? "text-gray-500 cursor-not-allowed"
          : "text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      }`}
      title={
        isDenied
          ? "Notifications are blocked in your browser settings"
          : undefined
      }
    >
      <div className="flex items-center">
        {pushState === "enabled" ? (
          <BellRing className="mr-3 w-[18px] h-[18px] text-[#34F080]" />
        ) : pushState === "denied" ? (
          <BellOff className="mr-3 w-[18px] h-[18px] text-red-400" />
        ) : (
          <Bell className="mr-3 w-[18px] h-[18px]" />
        )}
        <span className="text-[14px]">Notifications</span>
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
