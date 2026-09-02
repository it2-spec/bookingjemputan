-- ============================================================
-- Migration: Vendor Role & Approval Status untuk Invoice Harian
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah role 'vendor' ke tabel employees
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('employee', 'driver', 'admin', 'superadmin', 'vendor'));

-- 2. Tambah kolom approval vendor ke invoice_daily_overrides
ALTER TABLE invoice_daily_overrides
  ADD COLUMN IF NOT EXISTS vendor_approval_status VARCHAR(20)
    DEFAULT 'pending'
    CHECK (vendor_approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE invoice_daily_overrides
  ADD COLUMN IF NOT EXISTS vendor_approved_at TIMESTAMPTZ;

ALTER TABLE invoice_daily_overrides
  ADD COLUMN IF NOT EXISTS vendor_approved_by UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE invoice_daily_overrides
  ADD COLUMN IF NOT EXISTS vendor_approval_note TEXT;

-- 3. Index untuk pencarian cepat berdasarkan status approval
CREATE INDEX IF NOT EXISTS idx_invoice_overrides_approval_status
  ON invoice_daily_overrides(vendor_approval_status);

-- ============================================================
-- CATATAN:
-- Data historis (existing rows) akan mendapat vendor_approval_status = 'pending'
-- Jika ingin semua data lama otomatis dianggap approved, jalankan:
--
-- UPDATE invoice_daily_overrides
-- SET vendor_approval_status = 'approved',
--     vendor_approved_at = NOW()
-- WHERE is_billable = true
--   AND vendor_approval_status = 'pending';
-- ============================================================
