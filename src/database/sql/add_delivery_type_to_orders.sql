-- Migration: Add delivery_type column to orders table
-- Date: 2026-04-13
-- Description: Thêm cột phân loại giao hàng: GIAO_HANG, THU_HOI_VO, LUAN_CHUYEN

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50) DEFAULT 'GIAO_HANG';

-- Optional: Add constraint for valid delivery types
-- ALTER TABLE orders ADD CONSTRAINT check_delivery_type CHECK (
--     delivery_type IN ('GIAO_HANG', 'THU_HOI_VO', 'LUAN_CHUYEN')
-- );

COMMENT ON COLUMN orders.delivery_type IS 'Loại giao hàng: GIAO_HANG (Giao hàng), THU_HOI_VO (Thu hồi vỏ), LUAN_CHUYEN (Luân chuyển bình)';
