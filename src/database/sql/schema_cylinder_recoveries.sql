-- SQL Schema cho Phiếu Thu Hồi Vỏ Bình từ Khách Hàng

CREATE TABLE cylinder_recoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_code VARCHAR(100) NOT NULL UNIQUE,
    recovery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    driver_name VARCHAR(255),
    notes TEXT,
    total_items INTEGER DEFAULT 0,
    requested_quantity INTEGER DEFAULT 0, -- Tổng số vỏ thu yêu cầu
    created_by VARCHAR(255),              -- NV tạo phiếu
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_PHAN_CONG',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Đơn hàng liên kết
    photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cylinder_recovery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_id UUID NOT NULL REFERENCES cylinder_recoveries(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    condition VARCHAR(50) NOT NULL DEFAULT 'tot',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cylinder_recoveries ADD CONSTRAINT check_recovery_status CHECK (
    status IN ('CHO_PHAN_CONG', 'DANG_THU_HOI', 'CHO_DUYET', 'HOAN_THANH', 'HUY')
);

ALTER TABLE cylinder_recovery_items ADD CONSTRAINT check_item_condition CHECK (
    condition IN ('tot', 'hong', 'rong', 'moi', 'khac')
);

COMMENT ON TABLE cylinder_recoveries IS 'Phiếu thu hồi vỏ bình từ khách hàng';
COMMENT ON TABLE cylinder_recovery_items IS 'Chi tiết vỏ bình trong phiếu thu hồi';
