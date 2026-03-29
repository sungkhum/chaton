import { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import { subscribeToPush, requestPushPermission, isPushSupported, getExistingSubscription } from "../utils/push-notifications";

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
        registerPushSubscription(appUser.PublicKeyBase58Check);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "new-message":
              callbacks.onNewMessage?.(data.threadId, data.from);
              break;
            case "typing":
              callbacks.onTyping?.(data.from, data.conversationKey);
              break;
            case "presence":
              callbacks.onPresence?.(data.users);
              break;
            case "read":
              callbacks.onRead?.(data.from, data.conversationKey);
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
  }, [appUser, callbacks]);

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
        registerPushSubscription(appUser.PublicKeyBase58Check);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [appUser]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendNotify, sendTyping, sendRead, isConnected: !!wsRef.current };
}

// Track whether we've done the initial registration this session.
// Subsequent calls still refresh the subscription but skip the permission prompt.
const pushPermissionRequested = new Set<string>();

async function registerPushSubscription(publicKey: string) {
  if (!RELAY_URL || !isPushSupported()) return;

  try {
    // On first call per session, request permission (may prompt the user).
    // On subsequent calls (reconnect, subscription change), just refresh
    // the existing subscription without prompting.
    let subscription = await getExistingSubscription();

    if (!subscription) {
      if (pushPermissionRequested.has(publicKey)) return;
      pushPermissionRequested.add(publicKey);

      const granted = await requestPushPermission();
      if (!granted) return;

      subscription = await subscribeToPush();
    }

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
    // Push registration is best-effort
  }
}
