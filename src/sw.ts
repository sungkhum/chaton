import { defaultCache } from "@serwist/vite/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkOnly,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";
import { createStore, get, set } from "idb-keyval";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const idbStore = createStore("chattra-cache", "cache-store");

// Build-time env vars (injected by Vite/Serwist)
const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    ...defaultCache,
    {
      // DeSo API calls should always go to the network — never cache.
      // Registering an explicit NetworkOnly route silences the noisy
      // "No route found" warnings serwist logs for every unmatched request.
      matcher: ({ url }) => url.hostname === "node.deso.org",
      handler: new NetworkOnly(),
    },
    {
      // Cloudflare Stream manifests and segments must never be cached.
      // A cached 404 from a still-transcoding asset would permanently
      // break audio/video playback.
      matcher: ({ url }) =>
        url.hostname === "videodelivery.net" ||
        url.hostname === "iframe.videodelivery.net",
      handler: new NetworkOnly(),
    },
    {
      // Cache profile avatar images and other DeSo CDN images
      matcher: ({ url }) =>
        url.hostname.includes("images.deso.org") ||
        url.hostname.includes("images.bitclout.com") ||
        url.hostname.includes("cloudflare-ipfs.com") ||
        url.hostname.includes("arweave.net"),
      handler: new StaleWhileRevalidate({
        cacheName: "profile-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// ── Active-conversation tracking ──
// The client proactively tells the SW which conversation the user is viewing.
// This avoids the fragile MessageChannel round-trip during push and eliminates
// the 500ms timeout. If the SW restarts, this resets to null → all notifications
// show (fail-open, never fail-closed).
//
// iOS WebKit does not reliably fire visibilitychange when a PWA is backgrounded
// (WebKit bugs 202399, 205942, 207256), so the client may never send null.
// A TTL prevents stale values from suppressing notifications indefinitely.
let activeConversationKey: string | null = null;
let activeConversationSetAt = 0;
const ACTIVE_CONVERSATION_TTL_MS = 10_000; // 10 seconds
const IOS_UA_RE = /iPad|iPhone|iPod/;

function getActiveConversationKey(): string | null {
  if (!activeConversationKey) return null;
  if (Date.now() - activeConversationSetAt > ACTIVE_CONVERSATION_TTL_MS) {
    activeConversationKey = null;
    return null;
  }
  return activeConversationKey;
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "set-active-conversation") {
    activeConversationKey = event.data.conversationKey ?? null;
    activeConversationSetAt = Date.now();
  }

  // Allow the client to trigger skipWaiting when the user accepts the update
  if (event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});

// Handle push notifications.
// IMPORTANT: Always call showNotification() — iOS Safari revokes the push
// subscription after 3 push events that don't produce a visible notification.
self.addEventListener("push", (event) => {
  // Wrap json() in try/catch — malformed payload must not prevent
  // showNotification(), or iOS will count it as a silent push violation.
  let data: Record<string, unknown> = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Malformed payload — show generic notification below
  }

  event.waitUntil(
    (async () => {
      try {
        // For DMs the sender passes their own conversation key (which ends
        // with "default-key"), but the recipient indexes the same conversation
        // under the sender's public key.  Derive the local key so muted/unread
        // checks and notification-click navigation work correctly.
        // Group chat keys use a custom group name (not "default-key") and are
        // the same for all participants, so they need no translation.
        const rawConvKey = data.conversationKey as string | undefined;
        const fromPubKey = data.from as string | undefined;
        const isDM = rawConvKey?.endsWith("default-key");
        const localConvKey =
          fromPubKey && isDM ? fromPubKey + "default-key" : rawConvKey;

        // Check if this conversation is muted
        let isMuted = false;
        if (localConvKey) {
          try {
            const mutedList = await get<string[]>(
              "mutedConversations:active",
              idbStore
            );
            if (mutedList?.includes(localConvKey)) {
              isMuted = true;
            }
          } catch {
            // IndexedDB unavailable — default to not muted
          }
        }

        // Suppress if user is actively viewing this conversation.
        // All three conditions must be true to suppress (fail-open):
        //  1. A controlled client window is visible and focused
        //  2. We know which conversation is active (activeConversationKey != null)
        //  3. The active conversation matches the incoming push
        //
        // CRITICAL iOS CONSTRAINT: iOS Safari revokes the push subscription after
        // ~3 push events that don't call showNotification(). We CANNOT skip
        // showNotification() on iOS — ever. Additionally, iOS WebKit has bugs where
        // visibilityState stays "visible" and focused stays true after backgrounding,
        // making client state unreliable for suppression decisions.
        //
        // Strategy: skip suppression entirely on iOS. The WebSocket already provides
        // real-time in-app updates, so an extra notification while in-app is harmless
        // compared to losing the subscription entirely. On Chrome/Firefox, suppress
        // safely (they allow silent pushes when a visible client exists).
        const isIOS = IOS_UA_RE.test(self.navigator.userAgent);
        if (!isIOS && !isMuted && localConvKey) {
          try {
            const windowClients = await self.clients.matchAll({
              type: "window",
              includeUncontrolled: false,
            });
            const focusedClient = windowClients.find(
              (c) =>
                c.visibilityState === "visible" &&
                (c as { focused?: boolean }).focused
            );
            const currentActiveKey = getActiveConversationKey();
            if (
              focusedClient &&
              currentActiveKey &&
              currentActiveKey === localConvKey
            ) {
              // Forward to the focused client for in-app handling (e.g. scroll-to-bottom)
              focusedClient.postMessage({
                type: "push-received",
                payload: data,
              });
              return;
            }
          } catch {
            // Clients API unavailable — fall through to normal notification
          }
        }

        if (isMuted) {
          // iOS requires showNotification() on every push — show a silent,
          // self-replacing notification that disappears quickly.
          await self.registration.showNotification("ChatOn", {
            tag: "chaton-muted",
            silent: true,
            data: { url: "/" },
          });
          // Clean up the muted notification so it doesn't linger in the tray
          try {
            const muted = await self.registration.getNotifications({
              tag: "chaton-muted",
            });
            for (const n of muted) n.close();
          } catch {
            // getNotifications not supported (some browsers) — notification stays
          }
          return;
        }

        const title = (data.title as string) || "ChatOn";
        // Use localConvKey for the tag so both delivery paths (real-time DO
        // and cron/queue) produce the same tag after DM key translation.
        // Without this, DM notifications arrive with different tags (sender's
        // vs recipient's conversation key) and the browser shows both.
        const normalizedTag = localConvKey
          ? `thread-${localConvKey}`
          : (data.tag as string) || "chaton-notification";
        const options: NotificationOptions = {
          body: (data.body as string) || "You have a new message",
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: normalizedTag,
          renotify: true,
          data: {
            url: data.url || "/",
            conversationKey: localConvKey,
          },
        };

        await self.registration.showNotification(title, options);

        // Track unread conversation in IndexedDB and update badge count
        try {
          const convKey = localConvKey;
          const unread: string[] =
            (await get<string[]>("unreadConversations:active", idbStore)) || [];
          if (convKey && !unread.includes(convKey)) {
            unread.push(convKey);
            await set("unreadConversations:active", unread, idbStore);
          }
          await (
            self.navigator as Navigator & {
              setAppBadge: (n: number) => Promise<void>;
            }
          ).setAppBadge(unread.length);
        } catch {
          // Badge API or IndexedDB not supported
        }
      } catch {
        // DEFENSIVE FALLBACK: If anything above throws unexpectedly, always
        // show a generic notification. On iOS, failing to call showNotification()
        // counts as a silent push violation — 3 strikes and the subscription is
        // permanently revoked. This catch ensures we never hit that.
        try {
          await self.registration.showNotification("ChatOn", {
            body: "You have a new message",
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "chaton-fallback",
            data: { url: "/" },
          });
        } catch {
          // Truly nothing we can do — SW registration itself is broken
        }
      }
    })()
  );
});

// Handle subscription changes (browser rotated keys, subscription expired, etc.)
// Re-subscribes and syncs the new subscription directly to the relay server.
// This is critical when no client window is open — without this, the server
// holds a dead endpoint and the user stops receiving push until they reopen the app.
self.addEventListener("pushsubscriptionchange", ((
  event: Event & {
    oldSubscription?: PushSubscription;
    newSubscription?: PushSubscription;
    waitUntil: (p: Promise<unknown>) => void;
  }
) => {
  event.waitUntil(
    (async () => {
      try {
        let newSub = event.newSubscription;
        if (!newSub && event.oldSubscription?.options?.applicationServerKey) {
          newSub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              event.oldSubscription.options.applicationServerKey,
          });
        }

        // Sync the new subscription to the relay server directly from the SW.
        // This ensures push keeps working even if no client window is open.
        if (newSub && RELAY_URL) {
          try {
            // Read the user's public key from IDB (set by the app on login)
            const publicKey = await get<string>("push:publicKey", idbStore);
            if (publicKey) {
              await fetch(`${RELAY_URL}/push/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  publicKey,
                  subscription: newSub.toJSON(),
                  // No JWT available in SW context — server should accept
                  // subscription updates from the same endpoint origin
                }),
              });
            }
          } catch {
            // Best-effort — client will re-register on next visit
          }
        }

        // Notify any open app windows to re-register (with JWT)
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({ type: "push-subscription-changed" });
        }
      } catch {
        // Best-effort — client will re-register on next visit
      }
    })()
  );
}) as EventListener);

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const conversationKey = event.notification.data?.conversationKey;

  event.waitUntil(
    (async () => {
      // Persist the target conversation in IndexedDB BEFORE focusing/opening.
      // When the app resumes from a suspended state, postMessage is unreliable
      // (the JS context may still be unfreezing). IndexedDB survives across all
      // app states and the visibility-change handler picks it up on resume.
      if (conversationKey) {
        try {
          await set(
            "pendingNotificationConversation",
            conversationKey,
            idbStore
          );
        } catch {
          // IndexedDB unavailable — fall through to postMessage/URL param
        }
      }

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          // Still send postMessage as a fast path for when the app is active
          client.postMessage({
            type: "notification-click",
            conversationKey,
          });
          return;
        }
      }

      // Otherwise open new window — pass conversationKey so the app can navigate
      const openUrl = conversationKey
        ? `/?conversation=${conversationKey}`
        : url;
      await self.clients.openWindow(openUrl);
    })()
  );
});

serwist.addEventListeners();
