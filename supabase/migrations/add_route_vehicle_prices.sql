-- ============================================================
-- Migration: Tabel Harga Armada per Rute
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Tabel harga per rute × jenis armada
CREATE TABLE IF NOT EXISTS route_vehicle_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('Avanza', 'Elf Short', 'Elf Long')),
  price_per_day INTEGER NOT NULL DEFAULT 0,  -- harga dalam Rupiah (per hari/trip)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, vehicle_type)
);

-- RLS
ALTER TABLE route_vehicle_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read route_vehicle_prices" ON route_vehicle_prices
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert route_vehicle_prices" ON route_vehicle_prices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update route_vehicle_prices" ON route_vehicle_prices
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete route_vehicle_prices" ON route_vehicle_prices
  FOR DELETE USING (true);

-- ============================================================
-- SEED DATA: Harga Default (placeholder — edit via UI superadmin)
-- Harga dalam Rupiah per hari/trip per rute
-- ============================================================

-- Seed harga untuk semua rute yang ada
-- Catatan: route_id diambil dinamis dari tabel routes
INSERT INTO route_vehicle_prices (route_id, vehicle_type, price_per_day)
SELECT r.id, v.vehicle_type, v.price_per_day
FROM routes r
CROSS JOIN (
  VALUES
    ('Avanza',    400000),
    ('Elf Short', 700000),
    ('Elf Long',  1000000)
) AS v(vehicle_type, price_per_day)
ON CONFLICT (route_id, vehicle_type) DO NOTHING;
