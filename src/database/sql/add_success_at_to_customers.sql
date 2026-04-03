-- Ngày / thời điểm chuyển trạng thái "Thành công" (lead → khách chính)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS success_at TIMESTAMPTZ;

COMMENT ON COLUMN customers.success_at IS 'Thời điểm đánh dấu Thành công (ngày thành công); NULL khi Chưa thành công';

-- Gán ngược cho bản ghi đã Thành công nhưng chưa có mốc (ước lượng từ updated_at / created_at)
UPDATE customers
SET success_at = COALESCE(updated_at, created_at)
WHERE status = 'Thành công' AND success_at IS NULL;
