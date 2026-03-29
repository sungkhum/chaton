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

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "ChatOn";
  const options: NotificationOptions = {
    body: data.body || "You have a new message",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || "chaton-notification",
    data: {
      url: data.url || "/",
      conversationKey: data.conversationKey,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

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
