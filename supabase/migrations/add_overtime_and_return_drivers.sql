-- ============================================================
-- Migration: Dukungan Status Lembur (Tidak Ikut Pulang Reguler)
-- & Pengaturan Supir Pulang Sore Berbeda (Optional)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Status lembur di tabel bookings (default false: ikut PP reguler)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS is_overtime_no_return BOOLEAN DEFAULT FALSE;

-- 2. Penugasan supir pulang sore di invoice_daily_overrides (default kosong / ikuti supir berangkat)
ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS has_different_return_driver BOOLEAN DEFAULT FALSE;

ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS return_driver_assignments JSONB DEFAULT '{}'::jsonb;
