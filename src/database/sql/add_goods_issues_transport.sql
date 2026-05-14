-- Migration: Add transport info to goods_issues (xuất trả NCC)

ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS deliverer_name VARCHAR(255);
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS deliverer_address TEXT;
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS received_by VARCHAR(255);

COMMENT ON COLUMN goods_issues.deliverer_name IS 'Người vận chuyển / giao hàng trả về NCC';
COMMENT ON COLUMN goods_issues.deliverer_address IS 'Địa chỉ giao hàng đến NCC';
COMMENT ON COLUMN goods_issues.received_by IS 'Người nhận hàng tại NCC';
