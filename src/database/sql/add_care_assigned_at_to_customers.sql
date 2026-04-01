-- Migration: Thêm trường care_assigned_at để theo dõi thời điểm Sale nhận khách
ALTER TABLE customers ADD COLUMN IF NOT EXISTS care_assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Cập nhật dữ liệu cũ: Mặc định bằng created_at cho các khách hàng hiện tại
UPDATE customers SET care_assigned_at = created_at WHERE care_assigned_at IS NULL;

-- Comment mô tả
COMMENT ON COLUMN customers.care_assigned_at IS 'Thời điểm nhân viên kinh doanh bắt đầu nhận chăm sóc khách hàng này (Reset khi Sale khác cướp khách)';
