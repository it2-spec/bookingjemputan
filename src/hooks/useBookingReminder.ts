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

// Reminder schedule: 18:00 WIB + Test Time 11:48 WIB
const REMINDER_TIMES_WIB = [
  { hour: 11, minute: 55 },
  { hour: 17, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 0 },
];

function getWIBDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
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

  // 3. Scheduled automatic reminder check (runs every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated || !employee) return;

    const checkAndNotify = () => {
      const wibNow = getWIBDate();
      const currentHour = wibNow.getHours();
      const currentMinute = wibNow.getMinutes();

      // Check if current time matches 11:48 or 18:00 WIB
      const isTargetTime = REMINDER_TIMES_WIB.some(
        (t) => t.hour === currentHour && t.minute === currentMinute
      );

      if (isTargetTime) {
        const key = `reminder_test_${currentHour}_${currentMinute}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');
          showLocalNotification(
            '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
            `Halo ${employee.name.split(' ')[0]}, pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.`,
          );
        }
      }
    };

    scheduledRef.current = setInterval(checkAndNotify, 5000);
    checkAndNotify();

    return () => {
      if (scheduledRef.current) clearInterval(scheduledRef.current);
    };
  }, [isAuthenticated, employee]);
}
