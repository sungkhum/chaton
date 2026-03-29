import { defaultCache } from "@serwist/vite/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

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
      const title = (data.title as string) || "ChatOn";
      const options: NotificationOptions = {
        body: data.body || "You have a new message",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: data.tag || "chaton-notification",
        renotify: true,
        data: {
          url: data.url || "/",
          conversationKey: data.conversationKey,
        },
      };

      // Set app badge indicator
      try {
        await (self.navigator as Navigator & { setAppBadge: () => Promise<void> }).setAppBadge();
      } catch {
        // Badge API not supported or failed
      }

      return self.registration.showNotification(title, options);
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
        // Otherwise open new window
        return self.clients.openWindow(url);
      })
  );
});

serwist.addEventListeners();
