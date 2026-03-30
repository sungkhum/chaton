import { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import { isPushSupported, getExistingSubscription } from "../utils/push-notifications";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

interface WsCallbacks {
  onNewMessage?: (threadId: string, from: string) => void;
  onTyping?: (from: string, conversationKey: string) => void;
  onPresence?: (users: Record<string, "online" | "offline">) => void;
  onRead?: (from: string, conversationKey: string) => void;
}

export function useWebSocket(callbacks: WsCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const { appUser } = useStore();

  // Keep callbacks in a ref so the WebSocket message handler always calls
  // the latest version without needing to reconnect when they change.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const connect = useCallback(() => {
    if (!RELAY_URL || !appUser) return;

    try {
      const ws = new WebSocket(`${RELAY_URL}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        // Register this connection with our public key
        ws.send(
          JSON.stringify({
            type: "register",
            publicKey: appUser.PublicKeyBase58Check,
          })
        );
        // Register push subscription for offline notifications
        refreshPushSubscription(appUser.PublicKeyBase58Check);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "new-message":
              callbacksRef.current.onNewMessage?.(data.threadId, data.from);
              break;
            case "typing":
              callbacksRef.current.onTyping?.(data.from, data.conversationKey);
              break;
            case "presence":
              callbacksRef.current.onPresence?.(data.users);
              break;
            case "read":
              callbacksRef.current.onRead?.(data.from, data.conversationKey);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      scheduleReconnect();
    }
  }, [appUser]);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current),
      RECONNECT_MAX_MS
    );
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(connect, delay);
  }, [connect]);

  const sendNotify = useCallback(
    (threadId: string, recipients: string[], fromUsername?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "notify",
            threadId,
            recipients,
            from: appUser?.PublicKeyBase58Check,
            fromUsername,
          })
        );
      }
    },
    [appUser]
  );

  const sendTyping = useCallback(
    (conversationKey: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "typing",
            conversationKey,
          })
        );
      }
    },
    []
  );

  const sendRead = useCallback(
    (conversationKey: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "read",
            conversationKey,
          })
        );
      }
    },
    []
  );

  // Listen for service worker subscription change messages
  useEffect(() => {
    if (!appUser) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "push-subscription-changed") {
        refreshPushSubscription(appUser.PublicKeyBase58Check);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [appUser]);

  // Reconnect WebSocket when PWA resumes from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && appUser) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          reconnectAttempt.current = 0;
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [appUser, connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendNotify, sendTyping, sendRead, isConnected: !!wsRef.current };
}

/**
 * Silently refresh an existing push subscription with the server.
 * Does NOT prompt for permission — the NotificationToggle handles that.
 * This ensures the server has the latest subscription data on each reconnect.
 */
async function refreshPushSubscription(publicKey: string) {
  if (!RELAY_URL || !isPushSupported()) return;

  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return;

    await fetch(`${RELAY_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        subscription: subscription.toJSON(),
      }),
    });
  } catch {
    // Push refresh is best-effort
  }
}
