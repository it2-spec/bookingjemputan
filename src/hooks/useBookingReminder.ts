// ============================================================
// useBookingReminder Hook
// ============================================================
// - Subscribes device to Web Push on login
// - Schedules local reminder notifications at 17:00–18:30 WIB
// - Listens for Realtime broadcast from Admin (when app is open)

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveBooking } from './useBooking';
import {
  subscribeToPush,
  showLocalNotification,
  markReminderShown,
  hasReminderBeenShown,
  isPushSupported,
  requestNotificationPermission,
} from '../lib/notificationService';
import { getTomorrowDate } from '../lib/vehicleLogic';
import { supabase } from '../lib/supabase';

// Reminder schedule in WIB (UTC+7)
const REMINDER_TIMES_WIB = [
  { hour: 17, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 18, minute: 30 },
];

function getWIBDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function todayDateString(): string {
  return getWIBDate().toISOString().split('T')[0];
}

export function useBookingReminder() {
  const { employee, isAuthenticated } = useAuth();
  const tomorrowDate = getTomorrowDate();
  const { data: activeBooking } = useActiveBooking(employee?.id || null, tomorrowDate);
  const scheduledRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionRequestedRef = useRef(false);
  const subscribedRef = useRef(false);

  // 1. Request permission + subscribe to Web Push when user logs in
  useEffect(() => {
    if (!isAuthenticated || !employee || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;

    isPushSupported().then(async (supported) => {
      if (!supported) return;

      let permission = Notification.permission;

      if (permission === 'default') {
        // Delay slightly so user has a chance to see the app first
        await new Promise((r) => setTimeout(r, 5000));
        permission = await requestNotificationPermission();
      }

      if (permission === 'granted' && !subscribedRef.current) {
        subscribedRef.current = true;
        await subscribeToPush(employee.id);
      }
    });
  }, [isAuthenticated, employee]);

  // 2. Realtime Broadcast Listener from Admin (for when app is open)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase.channel('admin-notifications');
    channel
      .on('broadcast', { event: 'admin-broadcast' }, (payload) => {
        const { title, message } = payload.payload || {};
        if (title && message) {
          showLocalNotification(title, message);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // 3. Scheduled local reminder (for devices with app open)
  useEffect(() => {
    if (!isAuthenticated || !employee) return;
    if (Notification.permission !== 'granted') return;

    const checkAndNotify = () => {
      if (activeBooking) return;

      const today = todayDateString();
      if (hasReminderBeenShown(today)) return;

      const wibNow = getWIBDate();
      const currentHour = wibNow.getUTCHours();
      const currentMinute = wibNow.getUTCMinutes();

      const shouldNotify = REMINDER_TIMES_WIB.some(
        (t) => t.hour === currentHour && Math.abs(t.minute - currentMinute) <= 1,
      );

      if (shouldNotify) {
        markReminderShown(today);
        showLocalNotification(
          '🚌 Pengingat Booking Jemputan',
          `Hei ${employee.name.split(' ')[0]}, Anda belum memesan jemputan untuk besok! Batas pemesanan jam 20:00 WIB.`,
        );
      }
    };

    scheduledRef.current = setInterval(checkAndNotify, 30_000);
    checkAndNotify();

    return () => {
      if (scheduledRef.current) clearInterval(scheduledRef.current);
    };
  }, [isAuthenticated, employee, activeBooking]);
}
