-- Migration: Add driver_type column to employees table
-- Options: 'internal' (Driver Internal PT / Rp 0) | 'vendor' (Driver Sewa Vendor / Invoice)

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS driver_type VARCHAR(20) DEFAULT 'vendor';

-- Update existing drivers if needed (default to vendor, or internal for specific ones)
UPDATE employees
SET driver_type = 'vendor'
WHERE role = 'driver' AND driver_type IS NULL;
