-- ============================================================
-- Migration: Setup Otomatis Notifikasi ke Vendor Jam 19:01 WIB
-- Jadwal: 19:01 WIB (12:01 UTC) setiap hari
-- Pesan: "Pemesanan jemputan untuk besok, silahkan untuk dikonfirmasi"
-- Target: Akun Vendor (role = 'vendor') via Web Push & Realtime
-- ============================================================

-- 1. Bersihkan job lama jika sudah pernah dibuat
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-vendor-confirmation-1901') THEN
    PERFORM cron.unschedule('daily-vendor-confirmation-1901');
  END IF;
END $$;

-- 2. Jadwalkan cron job jam 19:01 WIB (12:01 UTC)
SELECT cron.schedule(
  'daily-vendor-confirmation-1901',
  '1 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vbrqodfvazorgipapwoz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'title', '📋 Konfirmasi Jemputan Besok',
      'message', 'Pemesanan jemputan untuk besok, silahkan untuk dikonfirmasi',
      'targetRole', 'vendor',
      'url', '/vendor',
      'unbookedOnly', false
    )
  );
  $$
);
