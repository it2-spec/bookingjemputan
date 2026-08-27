import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert a base64url string to Uint8Array for PushManager.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permission from the user (handles both Native APK & Web).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        return 'granted';
      } else if (permStatus.receive === 'denied') {
        return 'denied';
      }
      return 'default';
    } catch {
      return 'denied';
    }
  }

  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

/**
 * Check if push notifications are supported (handles both Native APK & Web).
 */
export async function isPushSupported(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Subscribe the current device to Push and save to Supabase.
 */
export async function subscribeToPush(employeeId: string): Promise<any> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== 'granted') return null;
      }

      await PushNotifications.register();

      // Listen for registration token
      return new Promise((resolve) => {
        PushNotifications.addListener('registration', async (token) => {
          const { supabase } = await import('./supabase');
          await supabase.from('push_subscriptions').upsert(
            {
              employee_id: employeeId,
              endpoint: `native:fcm:${token.value}`,
              p256dh: token.value,
              auth: 'native-android',
            },
            { onConflict: 'endpoint' }
          );
          resolve(token);
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.warn('[Push] Native register error:', err);
          resolve(null);
        });
      });
    }

    if (!(await isPushSupported())) return null;
    if (Notification.permission !== 'granted') return null;
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await savePushSubscription(employeeId, existing);
      return existing;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });

    await savePushSubscription(employeeId, subscription);
    return subscription;
  } catch (err) {
    console.warn('[Push] Subscribe failed:', err);
    return null;
  }
}

/**
 * Save or update the push subscription in Supabase.
 */
async function savePushSubscription(employeeId: string, subscription: PushSubscription) {
  const { supabase } = await import('./supabase');
  const json = subscription.toJSON();
  const { keys } = json;
  if (!keys?.p256dh || !keys?.auth) return;

  await supabase.from('push_subscriptions').upsert(
    {
      employee_id: employeeId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint' },
  );
}

/**
 * Unsubscribe the current device and remove from Supabase.
 */
export async function unsubscribeFromPush(employeeId: string) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const { supabase } = await import('./supabase');
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('employee_id', employeeId)
      .eq('endpoint', endpoint);
  } catch (err) {
    console.warn('[Push] Unsubscribe failed:', err);
  }
}

/**
 * Get current push subscription status from the browser / native APK.
 */
export async function getPushSubscriptionStatus(): Promise<'granted' | 'denied' | 'default' | 'subscribed'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'granted') return 'subscribed';
      if (perm.receive === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }

  if (!(await isPushSupported())) return 'denied';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'subscribed' : 'granted';
}

/**
 * Show a local notification (fallback for when app is open).
 */
export async function showLocalNotification(title: string, body: string, icon?: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: 'tracer_high_priority_channel',
        name: 'Notifikasi Penting Jemputan',
        description: 'Notifikasi pengingat pemesanan shuttle & status penjemputan',
        importance: 5, // High / Max priority (Heads-up alert)
        visibility: 1, // Public on lockscreen
        sound: 'beep.wav',
        vibration: true,
        lights: true,
        lightColor: '#1e40af',
      });

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            channelId: 'tracer_high_priority_channel',
            sound: 'beep.wav',
            actionTypeId: '',
            extra: null,
          },
        ],
      });
      return;
    } catch (e) {
      console.warn('[LocalNotif] Capacitor failed:', e);
    }
  }

  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notifIcon = icon || '/tracer.png';

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: notifIcon,
      badge: '/tracer.png',
      tag: 'shuttle-local-' + Date.now(),
      requireInteraction: true,
      renotify: true,
      vibrate: [200, 100, 200, 100, 500],
      silent: false,
      data: { url: '/' },
      actions: [
        { action: 'open', title: '📱 Buka Aplikasi' },
        { action: 'dismiss', title: 'Tutup' },
      ],
    } as any);
  } catch {
    new Notification(title, { body, icon: notifIcon });
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
