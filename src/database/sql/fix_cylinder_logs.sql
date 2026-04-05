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

-- 3. Create Trigger for Automated Logging
CREATE OR REPLACE FUNCTION func_log_cylinder_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description)
        VALUES (NEW.id, NEW.serial_number, NEW.warehouse_id, 'KHOI_TAO', 'Khởi tạo vỏ bình mới trên hệ thống');
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Log if status OR warehouse changed
        IF (OLD.status <> NEW.status OR OLD.warehouse_id IS DISTINCT FROM NEW.warehouse_id OR NEW.last_log_image IS NOT NULL) THEN
            INSERT INTO cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description, image_url)
            VALUES (
                NEW.id, 
                NEW.serial_number, 
                NEW.warehouse_id, 
                'CAP_NHAT_TRANG_THAI', 
                'Cập nhật trạng thái từ ' || OLD.status || ' sang ' || NEW.status || 
                CASE WHEN OLD.warehouse_id IS DISTINCT FROM NEW.warehouse_id THEN ' (Chuyển kho)' ELSE '' END,
                NEW.last_log_image
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON cylinders;
CREATE TRIGGER trig_log_cylinder_changes
AFTER INSERT OR UPDATE ON cylinders
FOR EACH ROW EXECUTE FUNCTION func_log_cylinder_activity();

-- Optional: Initial log for existing cylinders
-- INSERT INTO cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description)
-- SELECT id, serial_number, warehouse_id, 'HE_THONG', 'Ghi nhận tồn kho hiện tại'
-- FROM cylinders 
-- WHERE warehouse_id IS NOT NULL;
