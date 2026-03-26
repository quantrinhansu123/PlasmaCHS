-- ==============================================================================
-- SQL Views for Sales Report
-- Purpose: Aggregate revenue and order counts for sales reporting
-- ==============================================================================

-- Drop existing view to prevent conflicts and type issues
DROP VIEW IF EXISTS view_sales_summary_monthly CASCADE;

-- 1. Monthly Sales Summary by Customer and Salesperson
CREATE OR REPLACE VIEW view_sales_summary_monthly AS
SELECT 
    o.customer_name,
    o.sales_person as nvkd,
    o.customer_category as loai_khach,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN o.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN o.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN o.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN o.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE o.warehouse 
    END::VARCHAR(50) AS kho,
    EXTRACT(YEAR FROM o.created_at)::int as nam,
    EXTRACT(MONTH FROM o.created_at)::int as thang,
    SUM(o.total_amount) as doanh_so,
    COUNT(o.id) as so_don_hang
FROM orders o
LEFT JOIN warehouses w ON (w.id::text = o.warehouse OR w.name = o.warehouse)
WHERE o.order_type = 'THUONG'
AND o.status IN (
    'DA_DUYET', 
    'CHO_GIAO_HANG', 
    'DANG_GIAO_HANG', 
    'CHO_DOI_SOAT', 
    'HOAN_THANH',
    'DOI_SOAT_THAT_BAI'
)
GROUP BY 
    o.customer_name, 
    o.sales_person, 
    o.customer_category, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN o.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN o.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN o.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN o.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE o.warehouse 
    END::VARCHAR(50), 
    EXTRACT(YEAR FROM o.created_at), 
    EXTRACT(MONTH FROM o.created_at);

COMMENT ON VIEW view_sales_summary_monthly IS 'Báo cáo doanh số tổng hợp theo khách hàng, NVKD và thời gian.';
