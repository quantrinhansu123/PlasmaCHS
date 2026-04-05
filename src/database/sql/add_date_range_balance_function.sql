-- ==============================================================================
-- Function: get_customer_cylinder_balance_by_date
-- Purpose: Calculate inventory balance for any custom date range
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_customer_cylinder_balance_by_date(
    p_start_date DATE,
    p_end_date DATE,
    p_warehouse TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    kho VARCHAR(50),
    loai_khach TEXT,
    opening_balance BIGINT,
    xuat BIGINT,
    thu_hoi BIGINT,
    closing_balance BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH movements_before AS (
        -- Movements strictly before start_date
        SELECT 
            c.id as cid,
            SUM(o.quantity)::BIGINT as total_xuat,
            0::BIGINT as total_thu_hoi
        FROM orders o
        JOIN customers c ON c.name = o.customer_name
        WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
          AND o.created_at::DATE < p_start_date
          AND (p_warehouse IS NULL OR o.warehouse = p_warehouse)
          AND (p_category IS NULL OR c.category = p_category)
        GROUP BY c.id
        UNION ALL
        SELECT 
            c.id as cid,
            0::BIGINT as total_xuat,
            SUM(cr.total_items)::BIGINT as total_thu_hoi
        FROM cylinder_recoveries cr
        JOIN customers c ON c.id = cr.customer_id
        WHERE cr.status = 'HOAN_THANH'
          AND cr.created_at::DATE < p_start_date
          AND (p_warehouse IS NULL OR c.warehouse_id = p_warehouse)
          AND (p_category IS NULL OR c.category = p_category)
        GROUP BY c.id
    ),
    movements_period AS (
        -- Movements within [start_date, end_date]
        SELECT 
            c.id as cid,
            SUM(o.quantity)::BIGINT as period_xuat,
            0::BIGINT as period_thu_hoi
        FROM orders o
        JOIN customers c ON c.name = o.customer_name
        WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
          AND o.created_at::DATE >= p_start_date AND o.created_at::DATE <= p_end_date
          AND (p_warehouse IS NULL OR o.warehouse = p_warehouse)
          AND (p_category IS NULL OR c.category = p_category)
        GROUP BY c.id
        UNION ALL
        SELECT 
            c.id as cid,
            0::BIGINT as period_xuat,
            SUM(cr.total_items)::BIGINT as period_thu_hoi
        FROM cylinder_recoveries cr
        JOIN customers c ON c.id = cr.customer_id
        WHERE cr.status = 'HOAN_THANH'
          AND cr.created_at::DATE >= p_start_date AND cr.created_at::DATE <= p_end_date
          AND (p_warehouse IS NULL OR c.warehouse_id = p_warehouse)
          AND (p_category IS NULL OR c.category = p_category)
        GROUP BY c.id
    ),
    aggregated_before AS (
        SELECT cid, SUM(total_xuat - total_thu_hoi) as open_bal
        FROM movements_before
        GROUP BY cid
    ),
    aggregated_period AS (
        SELECT cid, SUM(period_xuat) as p_xuat, SUM(period_thu_hoi) as p_thu_hoi
        FROM movements_period
        GROUP BY cid
    )
    SELECT 
        c.id as customer_id,
        c.name::TEXT as customer_name,
        (CASE 
            WHEN w.name IS NOT NULL THEN w.name
            WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
            WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
            WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
            WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
            ELSE c.warehouse_id 
        END)::VARCHAR(50) AS kho,
        c.category::TEXT as loai_khach,
        COALESCE(ab.open_bal, 0)::BIGINT as opening_balance,
        COALESCE(ap.p_xuat, 0)::BIGINT as xuat,
        COALESCE(ap.p_thu_hoi, 0)::BIGINT as thu_hoi,
        (COALESCE(ab.open_bal, 0) + COALESCE(ap.p_xuat, 0) - COALESCE(ap.p_thu_hoi, 0))::BIGINT as closing_balance
    FROM customers c
    LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
    LEFT JOIN aggregated_before ab ON ab.cid = c.id
    LEFT JOIN aggregated_period ap ON ap.cid = c.id
    WHERE (COALESCE(ab.open_bal, 0) != 0 OR COALESCE(ap.p_xuat, 0) != 0 OR COALESCE(ap.p_thu_hoi, 0) != 0)
    AND (p_warehouse IS NULL OR c.warehouse_id = p_warehouse OR w.name = p_warehouse)
    AND (p_category IS NULL OR c.category = p_category);
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Function: get_machine_balance_by_date
-- Purpose: Calculate machine inventory balance for any custom date range
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_machine_balance_by_date(
    p_start_date DATE,
    p_end_date DATE,
    p_warehouse TEXT DEFAULT NULL
)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    kho VARCHAR(50),
    opening_balance BIGINT,
    xuat BIGINT,
    thu_hoi BIGINT,
    closing_balance BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH movements_before AS (
        SELECT 
            c.id as cid,
            SUM(o.quantity)::BIGINT as total_xuat,
            0::BIGINT as total_thu_hoi
        FROM orders o
        JOIN customers c ON c.name = o.customer_name
        WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
          AND (o.product_type LIKE '%MAY%' OR o.product_type = 'MAY')
          AND o.created_at::DATE < p_start_date
          AND (p_warehouse IS NULL OR o.warehouse = p_warehouse)
        GROUP BY c.id
        UNION ALL
        SELECT 
            c.id as cid,
            0::BIGINT as total_xuat,
            SUM(gri.quantity)::BIGINT as total_thu_hoi
        FROM goods_receipts gr
        JOIN goods_receipt_items gri ON gri.receipt_id = gr.id
        JOIN customers c ON c.name = gr.supplier_name
        WHERE gr.status = 'DA_NHAP' AND gri.item_type = 'MAY'
          AND gr.receipt_date::DATE < p_start_date
          AND (p_warehouse IS NULL OR gr.warehouse_id = p_warehouse)
        GROUP BY c.id
    ),
    movements_period AS (
        SELECT 
            c.id as cid,
            SUM(o.quantity)::BIGINT as period_xuat,
            0::BIGINT as period_thu_hoi
        FROM orders o
        JOIN customers c ON c.name = o.customer_name
        WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
          AND (o.product_type LIKE '%MAY%' OR o.product_type = 'MAY')
          AND o.created_at::DATE >= p_start_date AND o.created_at::DATE <= p_end_date
          AND (p_warehouse IS NULL OR o.warehouse = p_warehouse)
        GROUP BY c.id
        UNION ALL
        SELECT 
            c.id as cid,
            0::BIGINT as period_xuat,
            SUM(gri.quantity)::BIGINT as period_thu_hoi
        FROM goods_receipts gr
        JOIN goods_receipt_items gri ON gri.receipt_id = gr.id
        JOIN customers c ON c.name = gr.supplier_name
        WHERE gr.status = 'DA_NHAP' AND gri.item_type = 'MAY'
          AND gr.receipt_date::DATE >= p_start_date AND gr.receipt_date::DATE <= p_end_date
          AND (p_warehouse IS NULL OR gr.warehouse_id = p_warehouse)
        GROUP BY c.id
    ),
    aggregated_before AS (
        SELECT cid, SUM(total_xuat - total_thu_hoi) as open_bal
        FROM movements_before
        GROUP BY cid
    ),
    aggregated_period AS (
        SELECT cid, SUM(period_xuat) as p_xuat, SUM(period_thu_hoi) as p_thu_hoi
        FROM movements_period
        GROUP BY cid
    )
    SELECT 
        c.id as customer_id,
        c.name::TEXT as customer_name,
        (CASE 
            WHEN w.name IS NOT NULL THEN w.name
            WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
            WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
            WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
            WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
            ELSE c.warehouse_id 
        END)::VARCHAR(50) AS kho,
        COALESCE(ab.open_bal, 0)::BIGINT as opening_balance,
        COALESCE(ap.p_xuat, 0)::BIGINT as xuat,
        COALESCE(ap.p_thu_hoi, 0)::BIGINT as thu_hoi,
        (COALESCE(ab.open_bal, 0) + COALESCE(ap.p_xuat, 0) - COALESCE(ap.p_thu_hoi, 0))::BIGINT as closing_balance
    FROM customers c
    LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
    LEFT JOIN aggregated_before ab ON ab.cid = c.id
    LEFT JOIN aggregated_period ap ON ap.cid = c.id
    WHERE (COALESCE(ab.open_bal, 0) != 0 OR COALESCE(ap.p_xuat, 0) != 0 OR COALESCE(ap.p_thu_hoi, 0) != 0)
    AND (p_warehouse IS NULL OR c.warehouse_id = p_warehouse OR w.name = p_warehouse);
END;
$$ LANGUAGE plpgsql;
