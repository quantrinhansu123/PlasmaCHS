-- Add support for a second product line in the orders table
-- Updated: 2026-04-05

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_type_2 VARCHAR(50),
ADD COLUMN IF NOT EXISTS quantity_2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_price_2 NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount_2 NUMERIC(15, 2) DEFAULT 0;

-- Optional: Add constraint for product_type_2 (same as product_type)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_product_type_2') THEN
        ALTER TABLE orders ADD CONSTRAINT check_product_type_2 CHECK (
            product_type_2 IN ('BINH', 'MAY', 'MAY_ROSY', 'MAY_MED', 'BINH_4L', 'BINH_8L', 'TM', 'SD', 'FM', 'Khac', 'DNXM')
        );
    END IF;
END $$;

COMMENT ON COLUMN orders.product_type_2 IS 'Loại hàng hóa thứ 2 (Máy + Bình)';
COMMENT ON COLUMN orders.quantity_2 IS 'Số lượng hàng hóa thứ 2';
COMMENT ON COLUMN orders.unit_price_2 IS 'Đơn giá hàng hóa thứ 2';
COMMENT ON COLUMN orders.total_amount_2 IS 'Thành tiền hàng hóa thứ 2';
