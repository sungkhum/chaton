import { useEffect, useRef, useCallback, useState } from "react";
import { identity } from "deso-protocol";
import { useStore } from "../store";
import {
  isPushSupported,
  getExistingSubscription,
} from "../utils/push-notifications";
import { cachePushPublicKey } from "../services/cache.service";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

interface WsCallbacks {
  onNewMessage?: (threadId: string, from: string) => void;
  onTyping?: (from: string, conversationKey: string) => void;
  onPresence?: (users: Record<string, "online" | "offline">) => void;
  onRead?: (from: string, conversationKey: string) => void;
  onReadSync?: (conversationKey: string, timestamp: string) => void;
  onReadSyncBulk?: (cursors: Record<string, string>) => void;
}

export function useWebSocket(callbacks: WsCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set to false during cleanup so the old onclose handler doesn't schedule
  // a reconnect with a stale appUser after an account switch.
  const activeRef = useRef(true);
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

      ws.onopen = async () => {
        reconnectAttempt.current = 0;
        setConnected(true);
        // Register this connection with our public key + JWT proof
        try {
          const jwt = await identity.jwt();
          ws.send(
            JSON.stringify({
              type: "register",
              publicKey: appUser.PublicKeyBase58Check,
              jwt,
            })
          );
        } catch {
          // If JWT fails, register without it (server will reject)
          ws.send(
            JSON.stringify({
              type: "register",
              publicKey: appUser.PublicKeyBase58Check,
            })
          );
        }
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
            case "read-sync":
              if (data.cursors) {
                callbacksRef.current.onReadSyncBulk?.(data.cursors);
              } else if (data.conversationKey && data.timestamp) {
                callbacksRef.current.onReadSync?.(
                  data.conversationKey,
                  data.timestamp
                );
              }
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setConnected(false);
        if (activeRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (activeRef.current) scheduleReconnect();
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
    (
      threadId: string,
      recipients: string[],
      fromUsername?: string,
      groupName?: string
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "notify",
            threadId,
            recipients,
            from: appUser?.PublicKeyBase58Check,
            fromUsername,
            ...(groupName && { groupName }),
          })
        );
      }
    },
    [appUser]
  );

  const sendTyping = useCallback((conversationKey: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          conversationKey,
        })
      );
    }
  }, []);

  const sendRead = useCallback(
    (conversationKey: string, timestamp?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "read",
            conversationKey,
            ...(timestamp && { timestamp }),
          })
        );
      }
    },
    []
  );

  const sendReadSyncInit = useCallback((cursors: Record<string, string>) => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      Object.keys(cursors).length > 0
    ) {
      wsRef.current.send(JSON.stringify({ type: "read-sync-init", cursors }));
    }
  }, []);

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
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [appUser, connect]);

  useEffect(() => {
    activeRef.current = true;
    reconnectAttempt.current = 0;
    connect();
    return () => {
      activeRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    sendNotify,
    sendTyping,
    sendRead,
    sendReadSyncInit,
    isConnected: connected,
  };
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

    // Keep IDB public key fresh so the SW can re-register on key rotation
    cachePushPublicKey(publicKey);

    const jwt = await identity.jwt();
    await fetch(`${RELAY_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        jwt,
        subscription: subscription.toJSON(),
      }),
    });
  } catch {
    // Push refresh is best-effort
  }
}
