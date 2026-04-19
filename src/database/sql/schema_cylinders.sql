-- SQL Schema for PlasmaVN Cylinder (Bình khí) Management
-- Purpose: Tracking cylinders with detailed metadata and location tracking.

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove existing table to apply new schema
DROP TABLE IF EXISTS cylinders CASCADE;

-- Create table for cylinders
CREATE TABLE cylinders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) UNIQUE NOT NULL, -- 1. Serial (RFID mã quét được gắn trên vỏ bình)
    status VARCHAR(100) NOT NULL DEFAULT 'sẵn sàng', -- 2. Trạng thái (Sẵn sàng, đang sử dụng, thuộc KH...)
    net_weight NUMERIC(10, 2), -- 3. Khối lượng tịnh
    category VARCHAR(50) NOT NULL, -- 4. Thể loại (BV, TM)
    volume VARCHAR(100), -- 5. Thể tích (Dùng chung bộ cấu hình)
    gas_type VARCHAR(100), -- 6. Loại khí (AirMAC, N2, v.v...)
    valve_type VARCHAR(100), -- 7. Loại van (Messer, Tanaka...)
    handle_type VARCHAR(100), -- 8. Loại quai (Có quai, v.v...)
    
    -- Additional tracking fields
    customer_name VARCHAR(255), -- Tên khách hàng (Nếu bình đang giao cho KH hoặc status='thuộc khách hàng')
    cylinder_code VARCHAR(100) UNIQUE, -- Mã bình khắc trên vỏ (mã vật lý)
    expiry_date DATE, -- Ngày hết hạn bình (dùng cho báo cáo bình quá hạn)
    error_reason TEXT, -- Lý do lỗi (dùng khi status = 'hỏng')
    error_fixed_date DATE, -- Ngày sửa xong (dùng tính thời gian xử lý lỗi)
    error_reported_by VARCHAR(255), -- Người báo lỗi
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for cylinder status
ALTER TABLE cylinders ADD CONSTRAINT check_cylinder_status CHECK (
    status IN (
        'sẵn sàng', 
        'đang vận chuyển', 
        'đang sử dụng', 
        'đã sử dụng', 
        'chờ nạp', 
        'hỏng', 
        'thuộc khách hàng', 
        'bình rỗng',
        'đã trả ncc'
    )
);

-- Constraint for cylinder categories
ALTER TABLE cylinders ADD CONSTRAINT check_cylinder_category CHECK (
    category IN ('BV', 'TM')
);

-- Comments for clarity
COMMENT ON TABLE cylinders IS 'Bảng danh sách vỏ bình/bình khí PlasmaVN';
COMMENT ON COLUMN cylinders.serial_number IS 'Mã RFID quét được trên vỏ bình (VD: QR04116)';
COMMENT ON COLUMN cylinders.net_weight IS 'Khối lượng tịnh của bình khí (nhập số)';
