-- ==============================================================================
-- File: debug_date_range.sql
-- Mục đích: Kiểm tra và debug báo cáo theo khoảng ngày
-- Sử dụng: Chạy từng câu trong Supabase SQL Editor khi cần kiểm tra
-- ==============================================================================

-- ==================== PHẦN 1: KIỂM TRA DỮ LIỆU GỐC ====================

-- 1.1 Xem tất cả trạng thái đơn hàng hiện có
SELECT status, COUNT(*) as so_luong
FROM orders
GROUP BY status;

-- 1.2 Kiểm tra orders có dữ liệu với trạng thái đã duyệt không
SELECT COUNT(*) as total_orders, 
       MIN(created_at::DATE) as earliest_order,
       MAX(created_at::DATE) as latest_order
FROM orders 
WHERE status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH');

-- 1.3 Kiểm tra thu hồi bình
SELECT COUNT(*) as total_recoveries,
       MIN(created_at::DATE) as earliest_recovery,
       MAX(created_at::DATE) as latest_recovery
FROM cylinder_recoveries
WHERE status = 'HOAN_THANH';

-- 1.4 Kiểm tra JOIN orders + customers có khớp không
SELECT COUNT(*) as matched_orders
FROM orders o
JOIN customers c ON c.name = o.customer_name
WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH');

-- 1.5 Xem cấu trúc bảng orders
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 1.6 Xem mẫu dữ liệu orders
SELECT id, customer_name, status, created_at, quantity
FROM orders 
LIMIT 5;

-- 1.7 Xem mẫu dữ liệu customers
SELECT id, name
FROM customers 
LIMIT 5;


-- ==================== PHẦN 2: TEST CÁC HÀM RPC ====================

-- 2.1 Test hàm bình theo khách (khoảng ngày rộng nhất)
SELECT * FROM get_customer_cylinder_balance_by_date('2020-01-01'::DATE, '2030-12-31'::DATE);

-- 2.2 Test hàm máy theo khách (khoảng ngày rộng nhất)
SELECT * FROM get_machine_balance_by_date('2020-01-01'::DATE, '2030-12-31'::DATE);

-- 2.3 So sánh với view tháng cũ
SELECT COUNT(*) as monthly_cylinder_rows FROM view_customer_cylinder_monthly_balance;
SELECT COUNT(*) as monthly_machine_rows FROM view_machine_monthly_balance;


-- ==================== PHẦN 3: TẠO DỮ LIỆU TEST (NẾU CẦN) ====================

-- 3.1 Chuyển 1 đơn hàng sang trạng thái đã duyệt để test báo cáo
-- UPDATE orders SET status = 'DA_DUYET' 
-- WHERE id = (SELECT id FROM orders WHERE status = 'KHO_XU_LY' LIMIT 1);

-- 3.2 Khôi phục lại trạng thái sau khi test
-- UPDATE orders SET status = 'KHO_XU_LY'
-- WHERE id = (SELECT id FROM orders WHERE status = 'DA_DUYET' LIMIT 1);
