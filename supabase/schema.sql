-- ============================================================
-- Shuttle Booking — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nik VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_name VARCHAR(100) NOT NULL,
  departure_time TIME DEFAULT '07:30:00' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  departure_date DATE NOT NULL,
  seat_number INTEGER NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('Avanza', 'Elf Short', 'Elf Long')),
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  vehicle_lock BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- INDEXES
-- ============================================================

-- One active (confirmed) booking per employee per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_booking_per_day
  ON bookings(employee_id, departure_date)
  WHERE status = 'confirmed';

-- Prevent duplicate seats per route per day (only confirmed bookings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_seat_per_route_day
  ON bookings(route_id, departure_date, seat_number)
  WHERE status = 'confirmed';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_route_date
  ON bookings(route_id, departure_date);

CREATE INDEX IF NOT EXISTS idx_bookings_employee
  ON bookings(employee_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_employees_nik
  ON employees(nik);

-- ============================================================
-- SEED DATA: Routes
-- ============================================================

INSERT INTO routes (route_name, departure_time) VALUES
  ('Karawang Barat', '07:30:00'),
  ('Karawang Timur', '07:30:00'),
  ('Cikampek', '07:30:00')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA: Sample Employees (for testing)
-- ============================================================

INSERT INTO employees (nik, name, department, phone, role) VALUES
  ('1001', 'Ahmad Fauzi', 'Engineering', '081234567890', 'admin'),
  ('1002', 'Siti Nurhaliza', 'Human Resources', '081234567891', 'employee'),
  ('1003', 'Budi Santoso', 'Finance', '081234567892', 'employee'),
  ('1004', 'Dewi Lestari', 'Marketing', '081234567893', 'employee'),
  ('1005', 'Rizky Pratama', 'Engineering', '081234567894', 'employee'),
  ('1006', 'Putri Handayani', 'Operations', '081234567895', 'employee'),
  ('1007', 'Agus Setiawan', 'Engineering', '081234567896', 'employee'),
  ('1008', 'Maya Sari', 'Finance', '081234567897', 'employee'),
  ('1009', 'Dimas Prasetyo', 'Operations', '081234567898', 'employee'),
  ('1010', 'Rina Wulandari', 'Marketing', '081234567899', 'employee'),
  ('1011', 'Fajar Nugroho', 'Engineering', '081234567800', 'employee'),
  ('1012', 'Lina Marlina', 'Human Resources', '081234567801', 'employee'),
  ('1013', 'Hendra Wijaya', 'Finance', '081234567802', 'employee'),
  ('1014', 'Novi Anggraini', 'Operations', '081234567803', 'employee'),
  ('1015', 'Yoga Aditya', 'Engineering', '081234567804', 'employee'),
  ('1016', 'Wulan Dari', 'Marketing', '081234567805', 'employee'),
  ('1017', 'Arif Rahman', 'Engineering', '081234567806', 'employee'),
  ('1018', 'Indah Permata', 'Human Resources', '081234567807', 'employee'),
  ('1019', 'Bayu Firmansyah', 'Operations', '081234567808', 'employee'),
  ('1020', 'Citra Dewi', 'Finance', '081234567809', 'employee')
ON CONFLICT (nik) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Since we're using anon key with custom auth (NIK-based, not Supabase Auth),
-- we allow public read access and control writes via application logic.
-- For production, consider implementing Supabase Auth properly.

-- Employees: anyone can read (for login lookup)
CREATE POLICY "Allow public read employees" ON employees
  FOR SELECT USING (true);

-- Routes: anyone can read
CREATE POLICY "Allow public read routes" ON routes
  FOR SELECT USING (true);

-- Bookings: anyone can read/insert/update
-- In production, tighten these policies with proper auth
CREATE POLICY "Allow public read bookings" ON bookings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert bookings" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update bookings" ON bookings
  FOR UPDATE USING (true);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
