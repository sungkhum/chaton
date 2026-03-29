import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
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

export function NotificationToggle() {
  const { appUser } = useStore();
  const [pushState, setPushState] = useState<PushState>("disabled");
  const [loading, setLoading] = useState(false);

  // Determine initial state from browser permission + subscription + localStorage pref
  useEffect(() => {
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

    // If user explicitly disabled for this account, respect it
    if (pref === "false") {
      setPushState("disabled");
      return;
    }

    // Check if we have an active subscription and permission
    getExistingSubscription().then((sub) => {
      if (sub && permission === "granted" && pref !== "false") {
        setPushState("enabled");
      } else {
        setPushState("disabled");
      }
    });
  }, [appUser]);

  const enable = useCallback(async () => {
    if (!appUser || loading) return;
    setLoading(true);

    try {
      const permission = getNotificationPermission();

      // If denied, guide user to settings
      if (permission === "denied") {
        setPushState("denied");
        toast.error("Notifications are blocked. Enable them in your browser or device settings.");
        return;
      }

      // Request permission if not yet granted
      if (permission !== "granted") {
        const granted = await requestPushPermission();
        if (!granted) {
          // User clicked "Block" — now permanently denied
          const updated = getNotificationPermission();
          if (updated === "denied") {
            setPushState("denied");
            toast.error("Notifications blocked. You can re-enable them in your browser settings.");
          }
          return;
        }
      }

      // Subscribe at the browser level
      const subscription = await subscribeToPush();
      if (!subscription) {
        toast.error("Failed to enable notifications.");
        return;
      }

      // Register with the server
      if (RELAY_URL) {
        await fetch(`${RELAY_URL}/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: appUser.PublicKeyBase58Check,
            subscription: subscription.toJSON(),
          }),
        });
      }

      localStorage.setItem(getPrefKey(appUser.PublicKeyBase58Check), "true");
      setPushState("enabled");
      toast.success("Notifications enabled");
    } catch {
      toast.error("Failed to enable notifications.");
    } finally {
      setLoading(false);
    }
  }, [appUser, loading]);

  const disable = useCallback(async () => {
    if (!appUser || loading) return;
    setLoading(true);

    try {
      // Get endpoint before unsubscribing (needed for server-side cleanup)
      const subscription = await getExistingSubscription();
      const endpoint = subscription?.endpoint;

      await unsubscribeFromPush();

      // Tell the server to remove subscription
      if (RELAY_URL && endpoint) {
        await fetch(`${RELAY_URL}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: appUser.PublicKeyBase58Check,
            endpoint,
          }),
        });
      }

      localStorage.setItem(getPrefKey(appUser.PublicKeyBase58Check), "false");
      setPushState("disabled");
      toast.success("Notifications disabled");
    } catch {
      toast.error("Failed to disable notifications.");
    } finally {
      setLoading(false);
    }
  }, [appUser, loading]);

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
