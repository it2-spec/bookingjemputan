-- ============================================================
-- Migration: Setup Otomatis Pengingat Booking Harian (6 Jadwal)
-- Jadwal WIB: 16:30, 17:00, 17:30, 18:00, 18:30, 18:50 WIB
-- Target: Hanya untuk karyawan yang BELUM booking jemputan besok
-- Jalankan skrip ini di Supabase SQL Editor
-- ============================================================

-- 1. Aktifkan ekstensi pg_cron dan pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Bersihkan cron job lama jika ada
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobname FROM cron.job 
    WHERE jobname LIKE 'daily-reminder-%' 
       OR jobname LIKE 'daily-booking-reminder-%' 
       OR jobname LIKE 'test-booking-reminder-%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
  END LOOP;
END $$;

-- 3. Jadwal 1: 16:30 WIB (09:30 UTC)
SELECT cron.schedule(
  'daily-reminder-1630',
  '30 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
      'message', 'Pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.',
      'unbookedOnly', true
    )
  );
  $$
);

-- 4. Jadwal 2: 17:00 WIB (10:00 UTC)
SELECT cron.schedule(
  'daily-reminder-1700',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
      'message', 'Pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.',
      'unbookedOnly', true
    )
  );
  $$
);

-- 5. Jadwal 3: 17:30 WIB (10:30 UTC)
SELECT cron.schedule(
  'daily-reminder-1730',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup Jam 19:00 WIB!',
      'message', 'Pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera lakukan booking sekarang.',
      'unbookedOnly', true
    )
  );
  $$
);

-- 6. Jadwal 4: 18:00 WIB (11:00 UTC)
SELECT cron.schedule(
  'daily-reminder-1800',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup 1 Jam Lagi!',
      'message', 'Pemesanan jemputan untuk besok akan DITUTUP pukul 19:00 WIB! Segera amankan kursi Anda.',
      'unbookedOnly', true
    )
  );
  $$
);

-- 7. Jadwal 5: 18:30 WIB (11:30 UTC)
SELECT cron.schedule(
  'daily-reminder-1830',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '🚨 Pengingat: Booking Jemputan Tutup 30 Menit Lagi!',
      'message', 'Waktu booking jemputan tinggal 30 menit lagi (Tutup jam 19:00 WIB)! Segera lakukan booking.',
      'unbookedOnly', true
    )
  );
  $$
);

-- 8. Jadwal 6: 18:50 WIB (11:50 UTC - Last Call)
SELECT cron.schedule(
  'daily-reminder-1850',
  '50 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '⚠️ PENTING: 10 Menit Terakhir Booking Jemputan!',
      'message', 'Booking jemputan untuk besok akan DITUTUP tepat pukul 19:00 WIB. Segera booking sekarang!',
      'unbookedOnly', true
    )
  );
  $$
);
