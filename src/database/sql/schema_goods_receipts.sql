-- SQL Schema for PlasmaVN Goods Receipt (Phiếu Nhập Kho)
-- Purpose: Track goods imported from suppliers into company warehouses.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS goods_receipt_items CASCADE;
DROP TABLE IF EXISTS goods_receipts CASCADE;

-- Master: Phiếu nhập kho
CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_code VARCHAR(20) UNIQUE NOT NULL,        -- Mã phiếu (PN00001)
    supplier_name VARCHAR(255) NOT NULL,              -- Nhà cung cấp
    warehouse_id VARCHAR(50) NOT NULL,                -- Kho nhận (HN, TP.HCM, TH, DN)
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- Ngày nhập
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_DUYET',  -- Trạng thái
    note TEXT,                                        -- Ghi chú
    received_by VARCHAR(255),                         -- Người nhận hàng
    approved_by VARCHAR(255),                         -- Người duyệt
    total_items INTEGER NOT NULL DEFAULT 0,           -- Tổng số dòng hàng
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,   -- Tổng giá trị đơn hàng nhập

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Detail: Hàng hóa trong phiếu
CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,        -- MAY / BINH / VAT_TU
    item_name VARCHAR(255) NOT NULL,       -- Tên hàng hóa
    serial_number VARCHAR(100),            -- Mã serial (nếu có)
    item_status VARCHAR(50),               -- Trạng thái (Sẵn sàng, Kiểm tra...)
    quantity INTEGER NOT NULL DEFAULT 1,   -- Số lượng
    unit VARCHAR(50) NOT NULL DEFAULT 'cái', -- Đơn vị
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Đơn giá nhập
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Thành tiền (Số lượng * Đơn giá)
    note TEXT,                             -- Ghi chú dòng

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraints
ALTER TABLE goods_receipts ADD CONSTRAINT check_receipt_status CHECK (
    status IN ('CHO_DUYET', 'DA_NHAP', 'HOAN_THANH', 'HUY')
);

ALTER TABLE goods_receipts ADD CONSTRAINT check_receipt_warehouse CHECK (
    warehouse_id IN ('HN', 'TP.HCM', 'TH', 'DN')
);

ALTER TABLE goods_receipt_items ADD CONSTRAINT check_item_type CHECK (
    item_type IN ('MAY', 'BINH', 'VAT_TU')
);

-- Comments
COMMENT ON TABLE goods_receipts IS 'Phiếu nhập hàng từ nhà cung cấp vào kho PlasmaVN';
COMMENT ON TABLE goods_receipt_items IS 'Chi tiết hàng hóa trong phiếu nhập';
COMMENT ON COLUMN goods_receipts.receipt_code IS 'Mã phiếu nhập (VD: PN00001)';
COMMENT ON COLUMN goods_receipts.warehouse_id IS 'Kho nhận: HN, TP.HCM, TH, DN';
