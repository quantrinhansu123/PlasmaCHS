-- SQL Schema for PlasmaVN Warehouse Management
-- Purpose: Tracking warehouses and their capacities.

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove existing table to apply new schema
DROP TABLE IF EXISTS warehouses CASCADE;

-- Create table for warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL, -- 1. Tên kho
    manager_name VARCHAR(255) NOT NULL, -- 2. Thủ kho
    address TEXT NOT NULL, -- 3. Địa chỉ
    capacity INTEGER NOT NULL, -- 4. Sức chứa
    status VARCHAR(100) NOT NULL DEFAULT 'Đang hoạt động', -- 5. Trạng thái hoạt động
    branch_office VARCHAR(255),                            -- 6. Chi nhánh / Văn phòng đại diện
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for warehouse status
ALTER TABLE warehouses ADD CONSTRAINT check_warehouse_status CHECK (
    status IN (
        'Đang hoạt động', 
        'Tạm ngưng', 
        'Đóng cửa'
    )
);

-- Comments for clarity
COMMENT ON TABLE warehouses IS 'Bảng danh sách các kho hàng PlasmaVN';
COMMENT ON COLUMN warehouses.name IS 'Tên kho (Hà Nội, TP.HCM, Thanh Hóa, Đà Nẵng, v.v...)';
COMMENT ON COLUMN warehouses.capacity IS 'Sức chứa tối đa của kho (số lượng)';
