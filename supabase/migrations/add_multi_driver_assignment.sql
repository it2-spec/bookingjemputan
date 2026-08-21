-- ============================================================
-- Migration: Support Multi-Unit Driver & Multi-Unit Billable Overrides
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Multi-Unit Driver columns
ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS assigned_driver_id_unit2 UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS assigned_driver_id_unit3 UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS driver_assignments JSONB DEFAULT '{}'::jsonb;

-- Multi-Unit Billable / Source columns
ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS is_billable_unit2 BOOLEAN DEFAULT TRUE;

ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS is_billable_unit3 BOOLEAN DEFAULT TRUE;

ALTER TABLE invoice_daily_overrides 
ADD COLUMN IF NOT EXISTS unit_sources JSONB DEFAULT '{"1": true, "2": true, "3": true}'::jsonb;
