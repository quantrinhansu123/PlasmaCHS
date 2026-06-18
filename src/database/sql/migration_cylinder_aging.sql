-- Migration to add customer_assigned_at and setup aging view

-- 1. Add column to track when cylinder was assigned to customer
ALTER TABLE cylinders ADD COLUMN IF NOT EXISTS customer_assigned_at TIMESTAMP WITH TIME ZONE;

-- 2. Initialize the value for cylinders currently held by customers
UPDATE cylinders 
SET customer_assigned_at = updated_at 
WHERE status IN ('thuộc khách hàng', 'đang sử dụng') 
AND customer_assigned_at IS NULL;

-- 3. Create or replace the view for cylinder aging stats
CREATE OR REPLACE VIEW view_cylinder_aging_stats AS
SELECT 
    warehouse AS kho,
    COUNT(*) AS tong_so_binh_khach_giu,
    -- Quá hạn từ 31 đến 60 ngày
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 30 AND CURRENT_DATE - customer_assigned_at::DATE <= 60 THEN 1 END) AS qua_han_30_60,
    -- Quá hạn từ 61 đến 90 ngày
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 60 AND CURRENT_DATE - customer_assigned_at::DATE <= 90 THEN 1 END) AS qua_han_60_90,
    -- Quá hạn trên 90 ngày
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 90 THEN 1 END) AS qua_han_tren_90,
    -- Tổng số bình quá hạn (trên 30 ngày)
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 30 THEN 1 END) AS tong_qua_han
FROM cylinders
WHERE status IN ('thuộc khách hàng', 'đang sử dụng')
AND customer_assigned_at IS NOT NULL
GROUP BY warehouse;

COMMENT ON VIEW view_cylinder_aging_stats IS 'Thống kê ngày tồn bình của khách: Phân nhóm quá hạn >30, >60, >90 ngày';

-- 3.5 Create view for detailed cylinder aging (mã bình, khách hàng, số ngày)
CREATE OR REPLACE VIEW view_cylinder_aging_details AS
SELECT 
    id,
    serial_number AS ma_binh,
    customer_name AS khach_hang,
    warehouse AS kho,
    customer_assigned_at::DATE AS ngay_giao,
    CURRENT_DATE - customer_assigned_at::DATE AS so_ngay_ton
FROM cylinders
WHERE status IN ('thuộc khách hàng', 'đang sử dụng')
AND customer_assigned_at IS NOT NULL
AND CURRENT_DATE - customer_assigned_at::DATE > 30
ORDER BY so_ngay_ton DESC;

COMMENT ON VIEW view_cylinder_aging_details IS 'Chi tiết các bình bị khách giữ quá hạn >30 ngày để hiển thị thông tin mã, KH, thời gian.';

-- 4. Create trigger to automatically update customer_assigned_at when a cylinder is assigned to a customer
CREATE OR REPLACE FUNCTION update_customer_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changes to a customer-held status and it wasn't before
    IF (NEW.status IN ('thuộc khách hàng', 'đang sử dụng') AND (OLD.status NOT IN ('thuộc khách hàng', 'đang sử dụng') OR OLD.status IS NULL)) THEN
        NEW.customer_assigned_at = CURRENT_TIMESTAMP;
    -- If status changes to something else (e.g., returned to warehouse)
    ELSIF (NEW.status NOT IN ('thuộc khách hàng', 'đang sử dụng') AND OLD.status IN ('thuộc khách hàng', 'đang sử dụng')) THEN
        NEW.customer_assigned_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_assigned_at ON cylinders;
CREATE TRIGGER trg_update_customer_assigned_at
BEFORE UPDATE ON cylinders
FOR EACH ROW
EXECUTE FUNCTION update_customer_assigned_at();
