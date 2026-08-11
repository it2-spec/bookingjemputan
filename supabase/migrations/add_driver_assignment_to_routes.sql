-- ============================================================
-- Migration: Penugasan Supir (Driver Assignment) per Rute per Tanggal
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Tambahkan kolom assigned_driver_id ke tabel invoice_daily_overrides
ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES employees(id) ON DELETE SET NULL;
