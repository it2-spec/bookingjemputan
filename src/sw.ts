// ============================================================
// Custom Service Worker — Jemputan PWA
// Handles: Web Push events, notification clicks, and precache
// ============================================================

/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ============================================================
// Web Push Handler — fires even when the app is CLOSED
// ============================================================
self.addEventListener('push', (event: PushEvent) => {
  let title = '🚌 Jemputan SRI';
  let body = 'Ada notifikasi baru untuk Anda.';
  let icon = '/pwa-192x192.png';

  try {
    if (event.data) {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      icon = data.icon || icon;
    }
  } catch {
    body = event.data?.text() || body;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/pwa-192x192.png',
      tag: 'shuttle-notification',
      data: { url: '/' },
    }),
  );
});

// ============================================================
// Notification Click Handler — open / focus the app
// ============================================================
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// Skip waiting so new SW activates immediately
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
