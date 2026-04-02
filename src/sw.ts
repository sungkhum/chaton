import { defaultCache } from "@serwist/vite/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, ExpirationPlugin } from "serwist";
import { createStore, get, set } from "idb-keyval";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const idbStore = createStore("chattra-cache", "cache-store");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
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
});

// ── Active-conversation tracking ──
// The client proactively tells the SW which conversation the user is viewing.
// This avoids the fragile MessageChannel round-trip during push and eliminates
// the 500ms timeout. If the SW restarts, this resets to null → all notifications
// show (fail-open, never fail-closed).
let activeConversationKey: string | null = null;

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "set-active-conversation") {
    activeConversationKey = event.data.conversationKey ?? null;
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
      // For DMs the sender passes their own conversation key (which ends
      // with "default-key"), but the recipient indexes the same conversation
      // under the sender's public key.  Derive the local key so muted/unread
      // checks and notification-click navigation work correctly.
      // Group chat keys use a custom group name (not "default-key") and are
      // the same for all participants, so they need no translation.
      const rawConvKey = data.conversationKey as string | undefined;
      const fromPubKey = data.from as string | undefined;
      const isDM = rawConvKey?.endsWith("default-key");
      const localConvKey = (fromPubKey && isDM)
        ? fromPubKey + "default-key"
        : rawConvKey;

      // Check if this conversation is muted
      let isMuted = false;
      if (localConvKey) {
        try {
          const mutedList = await get<string[]>("mutedConversations:active", idbStore);
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
      // When suppressed, we skip showNotification() entirely — Chrome and Firefox
      // allow this when at least one visible client exists. We avoid a silent
      // tagged notification because iOS ignores the `tag` field, causing phantom
      // notifications to stack in the notification center.
      if (!isMuted && localConvKey) {
        try {
          const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: false });
          const focusedClient = windowClients.find(
            (c) => c.visibilityState === "visible" && (c as { focused?: boolean }).focused
          );
          if (focusedClient && activeConversationKey && activeConversationKey === localConvKey) {
            // Forward to the focused client for in-app handling (e.g. scroll-to-bottom)
            focusedClient.postMessage({ type: "push-received", payload: data });
            return;
          }
        } catch {
          // Clients API unavailable — fall through to normal notification
        }
      }

      if (isMuted) {
        // iOS requires showNotification() on every push — show a silent,
        // self-replacing notification that disappears quickly.
        return self.registration.showNotification("ChatOn", {
          tag: "chaton-muted",
          silent: true,
          data: { url: "/" },
        });
      }

      const title = (data.title as string) || "ChatOn";
      const options: NotificationOptions = {
        body: (data.body as string) || "You have a new message",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: (data.tag as string) || "chaton-notification",
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
        const unread: string[] = (await get<string[]>("unreadConversations:active", idbStore)) || [];
        if (convKey && !unread.includes(convKey)) {
          unread.push(convKey);
          await set("unreadConversations:active", unread, idbStore);
        }
        await (self.navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(unread.length);
      } catch {
        // Badge API or IndexedDB not supported
      }
    })()
  );
});

// Handle subscription changes (browser rotated keys, subscription expired, etc.)
// Re-subscribes to keep the browser subscription alive. The app will sync
// the new subscription to the server on the next visit.
self.addEventListener("pushsubscriptionchange", ((event: Event & {
  oldSubscription?: PushSubscription;
  newSubscription?: PushSubscription;
  waitUntil: (p: Promise<unknown>) => void;
}) => {
  event.waitUntil(
    (async () => {
      try {
        if (!event.newSubscription && event.oldSubscription?.options?.applicationServerKey) {
          await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription.options.applicationServerKey,
          });
        }
        // Notify any open app windows to re-register
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

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({
              type: "notification-click",
              conversationKey: event.notification.data?.conversationKey,
            });
            return;
          }
        }
        // Otherwise open new window — pass conversationKey so the app can navigate
        const conversationKey = event.notification.data?.conversationKey;
        const openUrl = conversationKey ? `/?conversation=${conversationKey}` : url;
        return self.clients.openWindow(openUrl);
      })
  );
});

serwist.addEventListeners();
