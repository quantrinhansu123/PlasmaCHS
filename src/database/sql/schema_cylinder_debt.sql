-- ==============================================================================
-- SQL Schema for Cylinder Debt Tracking
-- Provides real-time balance of cylinders held by customers
-- ==============================================================================

CREATE OR REPLACE VIEW view_customer_cylinder_debt AS
SELECT 
    c.customer_id,
    cust.name as customer_name,
    c.category as cylinder_type,
    COUNT(*) as debt_count
FROM cylinders c
JOIN customers cust ON cust.id = c.customer_id
WHERE c.customer_id IS NOT NULL 
  AND c.status != 'hỏng' -- Tùy chọn: chỉ tính bình đang sử dụng tốt
GROUP BY c.customer_id, cust.name, c.category;

-- Comment for documentation
COMMENT ON VIEW view_customer_cylinder_debt IS 'Thống kê nợ vỏ thực tế của khách hàng dựa trên vị trí bình hiện tại';
