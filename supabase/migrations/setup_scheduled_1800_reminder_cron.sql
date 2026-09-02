-- ============================================================
-- Migration: Setup Otomatis Notifikasi Pengingat Jam 18:00 WIB
-- Jalankan skrip ini di Supabase SQL Editor
-- ============================================================

-- 1. Aktifkan ekstensi pg_cron dan pg_net untuk HTTP request otomatis
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Hapus cron job lama jika sudah pernah dibuat
SELECT cron.unschedule('daily-booking-reminder-1800') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-booking-reminder-1800'
);

-- 3. Jadwalkan Cron Job setiap hari pukul 18:00 WIB
-- Catatan Timezone: Supabase pg_cron berjalan pada zona waktu UTC.
-- Jam 18:00 WIB = 11:00 UTC (18 - 7 jam)
-- Format Cron: 0 11 * * * (Menit 0, Jam 11 UTC setiap hari)
SELECT cron.schedule(
  'daily-booking-reminder-1800',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
      'message', 'Pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.'
    )
  );
  $$
);

-- ============================================================
-- OPSIONAL: Jadwal Pengingat Uji Coba (Testing)
-- Jika Anda ingin menguji cron beberapa menit dari sekarang, 
-- ganti format menit dan jam UTC (WIB - 7 Jam) lalu jalankan.
-- Contoh uji coba jam 13:50 WIB (06:50 UTC):
-- SELECT cron.schedule('test-reminder', '50 6 * * *', ...);
-- ============================================================
