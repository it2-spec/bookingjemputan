-- ============================================================
-- Migration: Tabel Status Invoice & Override per Tanggal/Rute
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_daily_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  departure_date DATE NOT NULL,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  is_billable BOOLEAN DEFAULT TRUE,            -- FALSE jika menggunakan driver internal / gratis
  override_vehicle_type VARCHAR(20),            -- Override armada jika disewa beda dari sistem
  custom_price INTEGER,                        -- Override harga jika ada diskon/harga khusus vendor
  note TEXT,                                   -- Catatan (misal: "Driver sendiri / Mobil PT")
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(departure_date, route_id)
);

-- RLS
ALTER TABLE invoice_daily_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read invoice_daily_overrides" ON invoice_daily_overrides
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert invoice_daily_overrides" ON invoice_daily_overrides
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update invoice_daily_overrides" ON invoice_daily_overrides
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete invoice_daily_overrides" ON invoice_daily_overrides
  FOR DELETE USING (true);
