-- Thêm cột ngày nhận máy cho khách hàng (an toàn khi chạy nhiều lần)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS machine_received_date DATE;

COMMENT ON COLUMN customers.machine_received_date
IS 'Ngày khách hàng nhận máy';
