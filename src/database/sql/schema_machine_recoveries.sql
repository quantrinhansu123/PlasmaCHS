-- SQL Schema cho Phiếu Thu Hồi Máy từ Khách Hàng
-- Cấu trúc tương tự cylinder_recoveries nhưng dành cho máy

CREATE TABLE IF NOT EXISTS machine_recoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_code VARCHAR(100) NOT NULL UNIQUE,
    recovery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    driver_name VARCHAR(255),
    notes TEXT,
    total_items INTEGER DEFAULT 0,
    requested_quantity INTEGER DEFAULT 0, -- Tổng số máy thu yêu cầu
    created_by VARCHAR(255),              -- NV tạo phiếu
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_PHAN_CONG',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Đơn hàng liên kết nếu có
    photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS machine_recovery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_id UUID NOT NULL REFERENCES machine_recoveries(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL, -- Serial máy
    condition VARCHAR(50) NOT NULL DEFAULT 'tot',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ràng buộc (Constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_machine_recovery_status') THEN
        ALTER TABLE machine_recoveries ADD CONSTRAINT check_machine_recovery_status CHECK (
            status IN ('CHO_PHAN_CONG', 'DANG_THU_HOI', 'CHO_DUYET', 'HOAN_THANH', 'HUY')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_machine_item_condition') THEN
        ALTER TABLE machine_recovery_items ADD CONSTRAINT check_machine_item_condition CHECK (
            condition IN ('tot', 'hong', 'loi', 'rong', 'moi', 'khac')
        );
    END IF;
END $$;

COMMENT ON TABLE machine_recoveries IS 'Phiếu thu hồi máy từ khách hàng';
COMMENT ON TABLE machine_recovery_items IS 'Chi tiết máy trong phiếu thu hồi';
