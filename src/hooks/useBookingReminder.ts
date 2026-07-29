// ============================================================
// useBookingReminder Hook
// ============================================================
// Schedules reminder notifications at 17:00, 17:30, 18:00, 18:30 WIB
// Only reminds if the employee has NOT yet booked for tomorrow.
// Reminder is suppressed once booking exists OR user dismissed for today.

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveBooking } from './useBooking';
import {
  requestNotificationPermission,
  showLocalNotification,
  markReminderShown,
  hasReminderBeenShown,
  isPushSupported,
} from '../lib/notificationService';
import { getTomorrowDate } from '../lib/vehicleLogic';
import { supabase } from '../lib/supabase';

// Reminder schedule in WIB (UTC+7) — minutes since midnight WIB
const REMINDER_TIMES_WIB = [
  { hour: 17, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 18, minute: 30 },
];

function getWIBDate(): Date {
  const now = new Date();
  // UTC+7
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function todayDateString(): string {
  const wib = getWIBDate();
  return wib.toISOString().split('T')[0];
}

export function useBookingReminder() {
  const { employee, isAuthenticated } = useAuth();
  const tomorrowDate = getTomorrowDate();
  const { data: activeBooking } = useActiveBooking(employee?.id || null, tomorrowDate);
  const scheduledRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionRequestedRef = useRef(false);

  // Request notification permission once when user is logged in
  useEffect(() => {
    if (!isAuthenticated || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;

    isPushSupported().then((supported) => {
      if (supported && Notification.permission === 'default') {
        // Small delay to not annoy user immediately after login
        setTimeout(() => {
          requestNotificationPermission();
        }, 5000);
      }
    });
  }, [isAuthenticated]);

  // Realtime Broadcast Listener from Admin
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

  // Reminder scheduling loop
  useEffect(() => {
    if (!isAuthenticated || !employee) return;
    if (Notification.permission !== 'granted') return;

    const checkAndNotify = () => {
      // Don't notify if already has booking
      if (activeBooking) return;

      const today = todayDateString();
      // Don't notify if already reminded today
      if (hasReminderBeenShown(today)) return;

      const wibNow = getWIBDate();
      const currentHour = wibNow.getUTCHours();
      const currentMinute = wibNow.getUTCMinutes();

      // Check if current time matches any reminder slot (within 1 minute window)
      const shouldNotify = REMINDER_TIMES_WIB.some(
        (t) => t.hour === currentHour && Math.abs(t.minute - currentMinute) <= 1
      );

      if (shouldNotify) {
        markReminderShown(today);
        showLocalNotification(
          '🚌 Pengingat Booking Jemputan',
          `Hei ${employee.name.split(' ')[0]}, Anda belum memesan jemputan untuk besok! Batas pemesanan jam 20:00 WIB.`,
        );
      }
    };

    // Check every 30 seconds
    scheduledRef.current = setInterval(checkAndNotify, 30_000);
    checkAndNotify(); // Run immediately on mount too

    return () => {
      if (scheduledRef.current) clearInterval(scheduledRef.current);
    };
  }, [isAuthenticated, employee, activeBooking]);
}
