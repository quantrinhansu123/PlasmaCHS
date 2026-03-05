-- ==============================================================================
-- SCHEMA: Khuyến mãi Bình Khí (Promotions)
-- DESCRIPTION: Bảng lưu trữ danh sách mã khuyến mãi (coupon) dùng để khấu trừ 
-- số lượng bình cho Khách hàng/Đại lý khi tạo đơn hàng.
-- ==============================================================================

-- 1. Xóa bảng nếu đã tồn tại (Cẩn thận khi chạy trên Production)
DROP TABLE IF EXISTS app_promotions CASCADE;

-- 2. Tạo bảng app_promotions
CREATE TABLE app_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,                      -- Mã nhận diện (VD: KM02), duy nhất
    free_cylinders INTEGER NOT NULL CHECK (free_cylinders > 0), -- Số lượng bình KM/khấu trừ
    start_date DATE NOT NULL,                              -- Ngày bắt đầu hiệu lực
    end_date DATE NOT NULL,                                -- Ngày kết thúc hiệu lực
    customer_type VARCHAR(20) NOT NULL,                    -- Đối tượng áp dụng (VD: 'TM', 'ĐL', 'Khác')
    target_mode VARCHAR(20) NOT NULL DEFAULT 'ALL',        -- ALL / CATEGORY / SPECIFIC
    target_categories JSONB DEFAULT '[]',                  -- Mảng loại KH: ["BV","TM","PK","NG"]
    target_customer_ids JSONB DEFAULT '[]',                -- Mảng UUID KH chỉ định
    is_active BOOLEAN DEFAULT true,                        -- Trạng thái Kích hoạt/Vô hiệu hóa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm các Constraints
ALTER TABLE app_promotions
ADD CONSTRAINT chk_date_validity CHECK (end_date >= start_date);

-- 3. Tạo Trigger tự động cập nhật updated_at
-- (Sử dụng hàm update_timestamp_func nếu đã có trong schema_users.sql, 
-- nếu chưa có thì phải tạo hàm trước. Giả định hàm update_timestamp_func đã tồn tại)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp_func') THEN
        CREATE TRIGGER update_app_promotions_modtime
        BEFORE UPDATE ON app_promotions
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp_func();
    END IF;
END $$;

-- 4. Thêm Policies (RLS - Row Level Security)
ALTER TABLE app_promotions ENABLE ROW LEVEL SECURITY;

-- Policy: Admin có toàn quyền (Giả định Auth của Supabase, hoặc bypass tạm thời cho Demo)
CREATE POLICY "Cho phép tất cả thao tác" ON app_promotions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Insert Sample Data
INSERT INTO app_promotions (code, free_cylinders, start_date, end_date, customer_type, is_active)
VALUES 
('KM02', 2, '2025-04-13', '2025-04-17', 'TM', true),
('KM_VIP', 5, '2024-01-01', '2024-12-31', 'ĐL', true);

-- In thông báo thành công
DO $$ 
BEGIN 
  RAISE NOTICE 'Bảng app_promotions đã được tạo thành công!'; 
END $$;
