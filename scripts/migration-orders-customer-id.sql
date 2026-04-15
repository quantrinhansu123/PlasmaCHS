-- ============================================================
-- Migration: Add customer_id to orders table
-- Chạy trong Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Thêm cột customer_id vào bảng orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Step 2: Tạo index để tăng tốc query theo customer_id
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Step 3: Backfill customer_id từ customer_name (match các đơn cũ)
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_name = c.name
  AND o.customer_id IS NULL;

-- Step 4: Kiểm tra kết quả
SELECT
    COUNT(*) AS total_orders,
    COUNT(customer_id) AS with_customer_id,
    COUNT(*) - COUNT(customer_id) AS missing_customer_id
FROM orders;

-- ============================================================
-- Kết quả mong đợi: missing_customer_id = 0 hoặc rất nhỏ
-- (chỉ còn đơn có customer_name không khớp với bảng customers)
-- ============================================================
