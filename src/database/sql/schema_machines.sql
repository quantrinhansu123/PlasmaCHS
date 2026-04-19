-- SQL Schema for PlasmaVN Machine Management (Expanded)
-- Purpose: Tracking machines with 10 detailed fields as requested.

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove existing table to apply new schema
DROP TABLE IF EXISTS machines CASCADE;

-- Create table for machines
CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) UNIQUE NOT NULL, -- 1. Serial (Mã máy)
    machine_account VARCHAR(100), -- 2. Tài khoản máy (Auto-fill from Serial)
    status VARCHAR(100) NOT NULL DEFAULT 'chưa xác định', -- 3. Trạng thái
    warehouse VARCHAR(50), -- Kho quản lý máy (HN, TP.HCM, TH, DN)
    bluetooth_mac VARCHAR(100), -- 4. BluetoothMAC
    machine_type VARCHAR(50) NOT NULL, -- 5. Loại máy (BV, TM, FM, IOT)
    version VARCHAR(100), -- 6. Phiên bản
    cylinder_volume VARCHAR(100), -- 7. Thể tích
    gas_type VARCHAR(100), -- 8. Loại khí
    valve_type VARCHAR(100), -- 9. Loại van
    emission_head_type VARCHAR(255), -- 10. Loại đầu phát
    
    -- Additional tracking fields
    customer_name VARCHAR(255), -- Used when status is 'thuộc khách hàng'
    department_in_charge VARCHAR(255), 
    
    -- Maintenance fields (for quarterly reports)
    maintenance_date DATE, -- Ngày bảo trì gần nhất
    maintenance_type VARCHAR(100), -- Loại bảo trì: bảo dưỡng, sửa chữa, kiểm tra
    maintenance_note TEXT, -- Ghi chú bảo trì
    next_maintenance_date DATE, -- Ngày bảo trì tiếp theo (dự kiến)
    maintenance_by VARCHAR(255), -- Người thực hiện bảo trì
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for machine status
ALTER TABLE machines ADD CONSTRAINT check_machine_status CHECK (
    status IN (
        'chưa xác định', 
        'sẵn sàng', 
        'thuộc khách hàng', 
        'kiểm tra', 
        'đang sửa', 
        'bảo trì',
        'đã trả ncc'
    )
);

-- Constraint for machine types
ALTER TABLE machines ADD CONSTRAINT check_machine_type CHECK (
    machine_type IN ('BV', 'TM', 'FM', 'IOT')
);

-- Comments for clarity
COMMENT ON TABLE machines IS 'Bảng danh sách máy móc thiết bị PlasmaVN (10 trường chi tiết)';
COMMENT ON COLUMN machines.serial_number IS 'Mã máy gắn trên vỏ bình (VD: PLT-25D1-50-TM)';
COMMENT ON COLUMN machines.cylinder_volume IS 'Bình 4L/ CGA870, Bình 8L/ CGA870, v.v...';
COMMENT ON COLUMN machines.gas_type IS 'ArgonMed, AirMAC, N2, O2, CO2, Air';
COMMENT ON COLUMN machines.valve_type IS 'Van Messer, Van Tanaka, Van CGA870, v.v...';
COMMENT ON COLUMN machines.emission_head_type IS 'Tia thường, Tia nhỏ, 3 tia, 5 tia, v.v...';
