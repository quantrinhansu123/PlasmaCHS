-- Migration: Add `code` column to warehouses + Fix orders.warehouse constraint
-- Purpose: Standardize warehouse references across orders, machines, and filtering
-- Date: 2026-04-23

-- ============================================================
-- STEP 1: Drop OLD constraints FIRST
-- ============================================================
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS check_warehouse_code;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_unique;
ALTER TABLE orders     DROP CONSTRAINT IF EXISTS check_warehouse;

-- ============================================================
-- STEP 2: Seed codes for ACTUAL warehouses (by name pattern)
-- ============================================================
UPDATE warehouses SET code = 'DN'   WHERE name ILIKE '%đà nẵng%' OR name ILIKE '%da nang%';
UPDATE warehouses SET code = 'CT'   WHERE name ILIKE '%cần thơ%'  OR name ILIKE '%can tho%';
UPDATE warehouses SET code = 'NM'   WHERE name ILIKE '%nhà máy%'  OR name ILIKE '%nha may%';
UPDATE warehouses SET code = 'NMK'  WHERE name = 'NMK-CHS';
UPDATE warehouses SET code = 'OCP1' WHERE name ILIKE '%ocp 1%'    OR name ILIKE '%ocp1%';
UPDATE warehouses SET code = 'VQ'   WHERE name ILIKE '%văn quán%' OR name ILIKE '%van quan%';
UPDATE warehouses SET code = 'VPMN' WHERE name = 'VPMN-CHS';

-- ============================================================
-- STEP 3: Add UNIQUE on warehouses.code
-- ============================================================
ALTER TABLE warehouses
    ADD CONSTRAINT warehouses_code_unique UNIQUE (code);

-- ============================================================
-- STEP 4: Xem các giá trị warehouse hiện tại trong orders
-- (Chạy query này trước để biết cần xử lý gì)
-- ============================================================
SELECT DISTINCT warehouse, COUNT(*) as so_don
FROM orders
WHERE warehouse IS NOT NULL
GROUP BY warehouse
ORDER BY so_don DESC;

-- ============================================================
-- STEP 5: NULL hóa các giá trị warehouse không hợp lệ trong orders
-- (các giá trị không nằm trong danh sách code hợp lệ)
-- ============================================================
UPDATE orders
SET warehouse = NULL
WHERE warehouse IS NOT NULL
  AND warehouse NOT IN ('DN', 'CT', 'NM', 'NMK', 'OCP1', 'VQ', 'VPMN',
                        'HN', 'TP.HCM', 'TH');

-- Verify: Sau UPDATE phải = 0 row không hợp lệ
SELECT DISTINCT warehouse FROM orders WHERE warehouse IS NOT NULL;

-- ============================================================
-- STEP 6: Thêm CHECK constraint sau khi data đã sạch
-- ============================================================
ALTER TABLE orders
    ADD CONSTRAINT check_warehouse CHECK (
        warehouse IS NULL OR
        warehouse IN ('DN', 'CT', 'NM', 'NMK', 'OCP1', 'VQ', 'VPMN',
                      'HN', 'TP.HCM', 'TH')
    );

-- ============================================================
-- STEP 7: Comment
-- ============================================================
COMMENT ON COLUMN warehouses.code IS 'Mã kho ngắn — khớp với orders.warehouse và machines.warehouse';

-- ============================================================
-- STEP 8: Verify warehouses — mọi kho phải có code
-- ============================================================
SELECT id, name, code FROM warehouses ORDER BY name;
