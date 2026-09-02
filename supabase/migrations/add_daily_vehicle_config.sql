-- ============================================================
-- Migration: Konfigurasi Armada Harian per Tanggal (Daily Vehicle Override)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom konfigurasi armada harian pada invoice_daily_overrides
ALTER TABLE invoice_daily_overrides ADD COLUMN IF NOT EXISTS daily_vehicle_type VARCHAR(20);
ALTER TABLE invoice_daily_overrides ADD COLUMN IF NOT EXISTS daily_unit_count INTEGER DEFAULT 1;

-- 2. Pastikan default seluruh rute pada tabel master routes adalah Otomatis (1 Unit)
UPDATE routes SET manual_vehicle_type = 'Auto', unit_count = 1 WHERE manual_vehicle_type IS NULL OR manual_vehicle_type != 'Auto';
