// ============================================================
// useBookingReminder Hook
// ============================================================
// - Subscribes device to Web Push on login
// - Schedules local reminder notifications at 17:00–18:30 WIB
// - Listens for Realtime broadcast from Admin (when app is open)

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToPush,
  showLocalNotification,
  isPushSupported,
  requestNotificationPermission,
} from '../lib/notificationService';
import { supabase } from '../lib/supabase';
import { getTomorrowDate } from '../lib/vehicleLogic';

// Reminder schedule: 16:30, 17:00, 17:30, 18:00, 18:30, 18:50 WIB
const REMINDER_TIMES_WIB = [
  { hour: 16, minute: 30 },
  { hour: 17, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 18, minute: 30 },
  { hour: 18, minute: 50 },
];

function getWIBDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
}

export function useBookingReminder() {
  const { employee, isAuthenticated } = useAuth();
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

    // Global broadcast channel
    const adminChannel = supabase.channel('admin-notifications');
    adminChannel
      .on('broadcast', { event: 'admin-broadcast' }, (payload) => {
        const { title, message } = payload.payload || {};
        if (title && message) {
          showLocalNotification(title, message);
        }
      })
      .subscribe();

    // Targeted direct notification channel for this specific employee
    let userChannel: any = null;
    if (employee?.id) {
      userChannel = supabase.channel(`user-notifications-${employee.id}`);
      userChannel
        .on('broadcast', { event: 'new-notification' }, (payload: any) => {
          const { title, message } = payload.payload || {};
          if (title && message) {
            showLocalNotification(title, message);
          }
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(adminChannel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, [isAuthenticated, employee?.id]);

  // 3. Scheduled automatic reminder check (runs every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated || !employee) return;

    const checkAndNotify = () => {
      const wibNow = getWIBDate();
      const currentHour = wibNow.getHours();
      const currentMinute = wibNow.getMinutes();

      // Check if current time matches target reminder times
      const isTargetTime = REMINDER_TIMES_WIB.some(
        (t) => t.hour === currentHour && t.minute === currentMinute
      );

      if (isTargetTime) {
        const key = `reminder_test_${currentHour}_${currentMinute}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'true');

          // Hanya kirim notifikasi jika user BELUM booking untuk besok
          const tomorrow = getTomorrowDate();
          supabase
            .from('bookings')
            .select('id')
            .eq('employee_id', employee.id)
            .eq('departure_date', tomorrow)
            .eq('status', 'confirmed')
            .maybeSingle()
            .then(({ data: existingBooking }) => {
              if (existingBooking) {
                // User sudah booking, tidak perlu pengingat
                return;
              }
              showLocalNotification(
                '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
                `Halo ${employee.name.split(' ')[0]}, pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.`,
              );
            });
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

