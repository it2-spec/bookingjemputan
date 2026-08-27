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
  let title = '🚌 TRACER – Jemputan SRI';
  let body = 'Ada notifikasi baru untuk Anda.';
  let icon = '/tracer.png';
  let url = '/';
  // unique tag = new popup for every push (like WhatsApp pesan baru)
  let tag = 'shuttle-' + Date.now();

  try {
    if (event.data) {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      icon = data.icon || icon;
      url = data.url || url;
      // If sender supplies a tag, use it; otherwise keep unique default
      if (data.tag) tag = data.tag;
    }
  } catch {
    body = event.data?.text() || body;
  }

  // Cast to any — renotify/vibrate/actions/silent are valid Web Push API fields
  // but not included in TypeScript's conservative NotificationOptions typings
  const notificationOptions = {
    body,
    icon,
    badge: '/tracer.png',
    tag,
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 500],
    silent: false,
    data: { url },
    actions: [
      { action: 'open', title: '📱 Buka Aplikasi' },
      { action: 'dismiss', title: 'Tutup' },
    ],
  };

  event.waitUntil(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self.registration.showNotification(title, notificationOptions as any),
  );
});

// ============================================================
// Notification Click Handler — open / focus the app
// ============================================================
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // If user tapped "Tutup" action button, just dismiss
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, navigate it to the right page and focus
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            (client as WindowClient).navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window/tab pointing to the app
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
