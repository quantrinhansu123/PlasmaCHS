-- SQL Script to fix Missing Cylinder Logs and Warehouse Tracking
-- Run this in the Supabase SQL Editor

-- 1. Add warehouse_id to cylinders if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cylinders' AND column_name='warehouse_id') THEN
        ALTER TABLE cylinders ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cylinders' AND column_name='last_log_image') THEN
        ALTER TABLE cylinders ADD COLUMN last_log_image TEXT;
    END IF;
END $$;

-- 2. Create cylinder_logs table
CREATE TABLE IF NOT EXISTS cylinder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cylinder_id UUID REFERENCES cylinders(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    warehouse_id UUID REFERENCES warehouses(id),
    action VARCHAR(100), -- 'NHAP_KHO', 'XUAT_KHO', 'CAP_NHAT_TRANG_THAI', v.v...
    description TEXT,
    image_url TEXT, -- Link ảnh bàn giao/chứng từ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Trigger for Automated Logging (dùng cột kho — xem fix_cylinder_log_trigger_kho.sql)
-- Chạy fix_cylinder_log_trigger_kho.sql thay vì block dưới nếu đã migrate sang kho/OCP1.

-- Optional: Initial log for existing cylinders
-- INSERT INTO cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description)
-- SELECT id, serial_number, warehouse_id, 'HE_THONG', 'Ghi nhận tồn kho hiện tại'
-- FROM cylinders 
-- WHERE warehouse_id IS NOT NULL;
