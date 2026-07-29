// ============================================================
// Push Notification Service
// ============================================================

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert a base64 VAPID public key to Uint8Array for PushManager.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Request notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

/**
 * Check if push notifications are supported and service worker is active.
 */
export async function isPushSupported(): Promise<boolean> {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Subscribe the user to push notifications via Service Worker.
 * Returns the subscription object or null if not supported/denied.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    if (!(await isPushSupported())) return null;
    if (Notification.permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    // No VAPID key = use local notification fallback only
    if (!VAPID_PUBLIC_KEY) return null;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    return subscription;
  } catch (err) {
    console.warn('Push subscribe failed:', err);
    return null;
  }
}

/**
 * Show a local notification (no server needed, works within SW context).
 */
export async function showLocalNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'shuttle-reminder',
      data: { url: '/' },
    } as NotificationOptions);
  } catch {
    // Fallback to basic Notification API
    new Notification(title, { body, icon: icon || '/pwa-192x192.png' });
  }
}

/**
 * Store the time of today's reminder shown (to avoid re-showing).
 */
export function markReminderShown(date: string) {
  localStorage.setItem('shuttle_reminder_shown_date', date);
}

/**
 * Check if today's reminder has already been shown.
 */
export function hasReminderBeenShown(date: string): boolean {
  return localStorage.getItem('shuttle_reminder_shown_date') === date;
}
