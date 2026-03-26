-- Migration: Add deliverer info to goods_receipts
-- Purpose: Track the specific person delivering and their address.

-- 1. Add deliverer_name column
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS deliverer_name VARCHAR(255);

-- 2. Add deliverer_address column
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS deliverer_address TEXT;

-- 3. Add comments for documentation
COMMENT ON COLUMN goods_receipts.deliverer_name IS 'Họ tên người giao hàng thực tế';
COMMENT ON COLUMN goods_receipts.deliverer_address IS 'Địa chỉ liên hệ/địa chỉ người giao hàng';
