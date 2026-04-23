-- Migration: Fix machines.warehouse references
-- Purpose: Convert UUIDs in machines.warehouse to standardized codes (CT, DN, etc.)
-- Date: 2026-04-23

-- 1. Update machines.warehouse using join with warehouses table
-- This replaces UUIDs with the corresponding 'code'
UPDATE machines m
SET warehouse = w.code
FROM warehouses w
WHERE m.warehouse = w.id::text;

-- 2. Optional: Verify after update
-- Any machine with a UUID-like string in warehouse should be gone
SELECT id, model, warehouse FROM machines LIMIT 20;
