-- Migration: Update idx_unique_seat_per_route_day to support multi-unit fleets
-- Allows multiple vehicles on the same route (e.g. 2x Avanza) to each have seats 1..6 independently.

DROP INDEX IF EXISTS idx_unique_seat_per_route_day;

CREATE UNIQUE INDEX idx_unique_seat_per_route_day
  ON bookings (route_id, departure_date, COALESCE(unit_number, 1), seat_number)
  WHERE status = 'confirmed';
