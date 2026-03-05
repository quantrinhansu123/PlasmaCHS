-- SQL Schema for PlasmaVN Order Management - Refined for 13 fields
-- Updated: 2026-02-26

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove existing table to apply new schema
DROP TABLE IF EXISTS orders CASCADE;

-- Create table for orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code VARCHAR(20) UNIQUE NOT NULL, -- 1. Mã đơn hàng (Number equivalent in DB)
    customer_category VARCHAR(50) NOT NULL, -- 2. Loại khách hàng (BV, TM, PK, NG)
    warehouse VARCHAR(50), -- 3. Kho (HN, TP.HCM, TH, ĐN)
    customer_name VARCHAR(255) NOT NULL, -- 4. Khách hàng
    recipient_name VARCHAR(255) NOT NULL, -- 5. Tên người nhận
    recipient_address TEXT NOT NULL, -- 6. Địa chỉ nhận
    recipient_phone VARCHAR(20) NOT NULL, -- 7. SĐT người nhận
    order_type VARCHAR(50) NOT NULL, -- 8. Loại đơn hàng (Thường, Demo, v.v...)
    note TEXT, -- 9. Ghi chú
    product_type VARCHAR(50) NOT NULL, -- 10. Loại hàng hóa (Máy + Bình)
    quantity INTEGER NOT NULL DEFAULT 1, -- 11. Số lượng
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0, -- 11.1 Đơn giá
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- 11.2 Thành tiền (Thường bằng quantity * unit_price)
    department VARCHAR(255), -- 12. Khoa sử dụng máy
    promotion_code VARCHAR(50), -- 13. Khuyến mãi

    -- Workflow specific fields
    delivery_unit VARCHAR(255), -- Đơn vị vận chuyển (Company delivery or 3rd party like Viettel Post, GHN, etc)
    shipper_id UUID REFERENCES shippers(id) ON DELETE SET NULL, -- Liên kết ID Đơn vị vận chuyển (Dùng để tính công nợ cước phí)
    shipping_fee NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Cước phí vận chuyển (Số tiền cần trả cho Đơn vị vận chuyển)
    delivery_image_url TEXT, -- Ảnh chứng từ đối soát (từ người giao hàng)
    assigned_cylinders TEXT[], -- Danh sách mã Serial RFID đã gán cho đơn hàng này
    
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_DUYET', -- Trạng thái xử lý
    ordered_by VARCHAR(255), -- Người đặt hàng (Hệ thống ghi nhận)
    sales_person VARCHAR(255), -- NV kinh doanh
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for order statuses
ALTER TABLE orders ADD CONSTRAINT check_order_status CHECK (
    status IN (
        'TAT_CA',            -- Tất cả
        'CHO_DUYET',         -- Chờ duyệt
        'CHO_CTY_DUYET',     -- Chờ Cty duyệt (Mới)
        'KHO_XU_LY',         -- Kho đang xử lý (Mới)
        'DIEU_CHINH',        -- Điều chỉnh
        'DA_DUYET',          -- Đã duyệt / Xuất kho
        'CHO_GIAO_HANG',     -- Chờ giao hàng
        'DANG_GIAO_HANG',    -- Đang giao hàng
        'CHO_DOI_SOAT',      -- Chờ đối soát
        'DOI_SOAT_THAT_BAI', -- Đối soát thất bại
        'HOAN_THANH',        -- Hoàn thành
        'HUY_DON'            -- Hủy đơn
    )
);

-- Constraint for customer categories
ALTER TABLE orders ADD CONSTRAINT check_customer_category CHECK (
    customer_category IN ('BV', 'TM', 'PK', 'NG', 'SP')
);

-- Constraint for warehouses
ALTER TABLE orders ADD CONSTRAINT check_warehouse CHECK (
    warehouse IN ('HN', 'TP.HCM', 'TH', 'DN')
);

-- Constraint for product types
ALTER TABLE orders ADD CONSTRAINT check_product_type CHECK (
    product_type IN ('BINH', 'MAY', 'MAY_ROSY', 'MAY_MED', 'BINH_4L', 'BINH_8L')
);

-- Comments for clarity
COMMENT ON TABLE orders IS 'Bảng danh sách đơn hàng PlasmaVN';
COMMENT ON COLUMN orders.order_code IS 'Mã đơn hàng số (ví dụ: 804)';
COMMENT ON COLUMN orders.customer_category IS 'Loại khách: BV (Bệnh viện), TM (Thẩm mỹ), PK (Phòng khám), NG (Ngoại giao), SP (Spa / Khác)';
