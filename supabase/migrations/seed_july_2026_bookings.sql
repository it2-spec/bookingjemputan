-- ============================================================
-- Seed Data Dummy Booking Juli 2026 (Fix Unique Constraint & Random Employees)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Pastikan minimal ada 40 karyawan agar tidak kehabisan employee per hari
INSERT INTO employees (nik, name, department, phone, role)
SELECT 
  'DUMMY_' || LPAD(i::text, 4, '0'),
  'Karyawan Dummy ' || i,
  'Operational',
  '0812' || LPAD(i::text, 8, '0'),
  'employee'
FROM generate_series(1, 50) AS i
ON CONFLICT (nik) DO NOTHING;

-- 2. Hapus booking lama di bulan Juli 2026
DELETE FROM bookings 
WHERE departure_date >= '2026-07-01' AND departure_date <= '2026-07-31';

-- 3. Seed data booking sesuai Excel
WITH 
target_routes AS (
  SELECT 
    (SELECT id FROM routes WHERE route_name LIKE '%Karawang Barat%' LIMIT 1) AS kb,
    (SELECT id FROM routes WHERE route_name LIKE '%Karawang Timur%' LIMIT 1) AS kt,
    (SELECT id FROM routes WHERE route_name LIKE '%Cikampek%' LIMIT 1) AS ck
),
raw_recap (departure_date, route_id, vehicle_type, passenger_count) AS (
  SELECT '2026-07-01'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-01'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-01'::date, ck, 'Elf Short', 10 FROM target_routes UNION ALL
  
  SELECT '2026-07-02'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-02'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-02'::date, ck, 'Elf Short', 11 FROM target_routes UNION ALL
  
  SELECT '2026-07-03'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-03'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-03'::date, ck, 'Elf Short', 10 FROM target_routes UNION ALL
  
  SELECT '2026-07-06'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-06'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-06'::date, ck, 'Elf Short', 8  FROM target_routes UNION ALL
  
  SELECT '2026-07-07'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-07'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-07'::date, ck, 'Elf Short', 9  FROM target_routes UNION ALL
  
  SELECT '2026-07-08'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-08'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-08'::date, ck, 'Elf Short', 8  FROM target_routes UNION ALL
  
  SELECT '2026-07-09'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-09'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-09'::date, ck, 'Elf Short', 9  FROM target_routes UNION ALL
  
  SELECT '2026-07-10'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-10'::date, kt, 'Avanza',    5  FROM target_routes UNION ALL
  SELECT '2026-07-10'::date, ck, 'Elf Short', 7  FROM target_routes UNION ALL
  
  SELECT '2026-07-13'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-13'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-13'::date, ck, 'Elf Short', 12 FROM target_routes UNION ALL
  
  SELECT '2026-07-14'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-14'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-14'::date, ck, 'Elf Short', 10 FROM target_routes UNION ALL
  
  SELECT '2026-07-15'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-15'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-15'::date, ck, 'Elf Short', 9  FROM target_routes UNION ALL
  
  SELECT '2026-07-16'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-16'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-16'::date, ck, 'Elf Short', 10 FROM target_routes UNION ALL
  
  SELECT '2026-07-17'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-17'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-17'::date, ck, 'Avanza',    6  FROM target_routes UNION ALL
  
  SELECT '2026-07-20'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-20'::date, kt, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-20'::date, ck, 'Elf Short', 8  FROM target_routes UNION ALL
  
  SELECT '2026-07-21'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-21'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-21'::date, ck, 'Elf Short', 8  FROM target_routes UNION ALL
  
  SELECT '2026-07-22'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-22'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-22'::date, ck, 'Elf Short', 7  FROM target_routes UNION ALL
  
  SELECT '2026-07-23'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-23'::date, kt, 'Elf Short', 7  FROM target_routes UNION ALL
  SELECT '2026-07-23'::date, ck, 'Elf Short', 8  FROM target_routes UNION ALL
  
  SELECT '2026-07-24'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-24'::date, kt, 'Avanza',    6  FROM target_routes UNION ALL
  SELECT '2026-07-24'::date, ck, 'Avanza',    6  FROM target_routes UNION ALL
  
  SELECT '2026-07-27'::date, kb, 'Elf Short', 11 FROM target_routes UNION ALL
  SELECT '2026-07-27'::date, kt, 'Elf Short', 8  FROM target_routes UNION ALL
  SELECT '2026-07-27'::date, ck, 'Elf Short', 10 FROM target_routes UNION ALL
  
  SELECT '2026-07-28'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-28'::date, kt, 'Elf Short', 12 FROM target_routes UNION ALL
  SELECT '2026-07-28'::date, ck, 'Elf Short', 12 FROM target_routes UNION ALL
  
  SELECT '2026-07-29'::date, kb, 'Elf Short', 11 FROM target_routes UNION ALL
  SELECT '2026-07-29'::date, kt, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-29'::date, ck, 'Elf Short', 9  FROM target_routes UNION ALL
  
  SELECT '2026-07-30'::date, kb, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-30'::date, kt, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-30'::date, ck, 'Elf Long',  15 FROM target_routes UNION ALL
  
  SELECT '2026-07-31'::date, kb, 'Elf Short', 10 FROM target_routes UNION ALL
  SELECT '2026-07-31'::date, kt, 'Elf Short', 9  FROM target_routes UNION ALL
  SELECT '2026-07-31'::date, ck, 'Elf Short', 12 FROM target_routes
),
expanded_seats AS (
  SELECT 
    r.departure_date,
    r.route_id,
    r.vehicle_type,
    generate_series(1, r.passenger_count) AS seat_number,
    ROW_NUMBER() OVER (PARTITION BY r.departure_date ORDER BY r.route_id, generate_series(1, r.passenger_count)) AS day_seat_seq
  FROM raw_recap r
  WHERE r.passenger_count > 0 AND r.route_id IS NOT NULL
),
indexed_employees AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS emp_idx
  FROM employees
)
INSERT INTO bookings (
  employee_id,
  route_id,
  departure_date,
  seat_number,
  vehicle_type,
  status,
  created_at
)
SELECT 
  e.id AS employee_id,
  s.route_id,
  s.departure_date,
  s.seat_number,
  s.vehicle_type,
  'confirmed' AS status,
  (s.departure_date - INTERVAL '1 day' + INTERVAL '19 hours') AS created_at
FROM expanded_seats s
JOIN indexed_employees e ON e.emp_idx = s.day_seat_seq
ON CONFLICT (employee_id, departure_date) WHERE status = 'confirmed' DO UPDATE 
SET vehicle_type = EXCLUDED.vehicle_type, route_id = EXCLUDED.route_id;
