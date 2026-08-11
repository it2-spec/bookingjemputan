-- ============================================================
-- Migration: Tabel Penugasan Driver per Rute & Tanggal
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS route_driver_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  departure_date DATE NOT NULL,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(departure_date, route_id)
);

-- RLS
ALTER TABLE route_driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read route_driver_assignments" ON route_driver_assignments
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert route_driver_assignments" ON route_driver_assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update route_driver_assignments" ON route_driver_assignments
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete route_driver_assignments" ON route_driver_assignments
  FOR DELETE USING (true);
