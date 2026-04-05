-- ==============================================================================
-- SUPER COMPLETE Repair Script: Recreate ALL Missing Report Views
-- Purpose: Run this script in Supabase SQL Editor to fix 404 errors
-- This script contains the COMPLETE set of views for all application reports.
-- ==============================================================================

-- 0. Drop existing views to avoid type mismatch errors
DROP VIEW IF EXISTS view_customer_cylinder_monthly_balance CASCADE;
DROP VIEW IF EXISTS view_customer_cylinder_movements CASCADE;
DROP VIEW IF EXISTS view_machine_monthly_balance CASCADE;
DROP VIEW IF EXISTS view_machine_movements_combined CASCADE;
DROP VIEW IF EXISTS view_error_summary_monthly CASCADE;
DROP VIEW IF EXISTS view_customer_stats CASCADE;
DROP VIEW IF EXISTS view_salesperson_stats CASCADE;
DROP VIEW IF EXISTS view_cylinder_expiry CASCADE;
DROP VIEW IF EXISTS view_customer_expiry CASCADE;
DROP VIEW IF EXISTS view_cylinder_errors CASCADE;
DROP VIEW IF EXISTS view_machine_stats CASCADE;
DROP VIEW IF EXISTS view_machine_summary CASCADE;
DROP VIEW IF EXISTS view_orders_monthly CASCADE;
DROP VIEW IF EXISTS view_dashboard_summary CASCADE;
DROP VIEW IF EXISTS view_machine_revenue CASCADE;
DROP VIEW IF EXISTS view_sales_summary_monthly CASCADE;

-- 1. view_customer_stats
CREATE OR REPLACE VIEW view_customer_stats AS
SELECT 
    c.id,
    c.code AS ma_khach_hang,
    c.name AS ten_khach_hang,
    c.customer_type AS loai_khach_hang,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END::VARCHAR(50) AS kho,
    c.category AS loai_khach,
    (SELECT COUNT(*) FROM machines m WHERE m.customer_name = c.name) AS may_dang_su_dung,
    (SELECT COUNT(*) FROM cylinders cy WHERE cy.customer_name = c.name) AS binh_hien_co,
    c.borrowed_cylinders AS vo_binh_dang_muon,
    COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.customer_name = c.name AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')), 0) AS binh_xuat,
    COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.customer_name = c.name AND o.order_type IN ('Xuất bán', 'BAN', 'THUE', 'THUONG') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')), 0) AS binh_ban,
    COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.customer_name = c.name AND o.order_type IN ('Demo', 'DEMO') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')), 0) AS binh_demo,
    COALESCE((SELECT SUM(cri.total_items) FROM cylinder_recoveries cri JOIN customers c2 ON c2.id = cri.customer_id WHERE c2.id = c.id AND cri.status = 'HOAN_THANH'), 0) AS vo_thu_hoi,
    c.care_by AS nhan_vien_kin_doanh,
    c.last_order_date AS ngay_dat_hang_gan_nhat,
    c.machines_in_use AS danh_sach_may,
    (SELECT STRING_AGG(serial_number, ', ') FROM cylinders cy WHERE cy.customer_name = c.name) AS danh_sach_binh
FROM customers c
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id);

-- 2. view_salesperson_stats
CREATE OR REPLACE VIEW view_salesperson_stats AS
WITH salesperson_names AS (
    SELECT DISTINCT name FROM app_users WHERE role NOT IN ('Admin', 'admin')
    UNION
    SELECT DISTINCT care_by FROM customers WHERE care_by IS NOT NULL AND care_by != ''
    UNION
    SELECT DISTINCT sales_person FROM orders WHERE sales_person IS NOT NULL AND sales_person != ''
)
SELECT 
    u.id,
    sn.name AS ten_nhan_vien,
    COALESCE(u.phone, '-') AS so_dien_thoai,
    COALESCE(u.role, 'Kinh doanh') AS vai_tro,
    (SELECT COUNT(*) FROM customers c WHERE c.care_by = sn.name) AS tong_khach_hang,
    (SELECT COUNT(*) FROM orders o WHERE o.sales_person = sn.name AND o.order_type IN ('Xuất bán', 'BAN', 'THUE', 'THUONG') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS don_xuat_ban,
    (SELECT COALESCE(SUM(o.quantity), 0) FROM orders o WHERE o.sales_person = sn.name AND o.order_type IN ('Xuất bán', 'BAN', 'THUE', 'THUONG') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS binh_ban,
    (SELECT COUNT(*) FROM orders o WHERE o.sales_person = sn.name AND o.order_type IN ('Demo', 'DEMO') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS don_demo,
    (SELECT COALESCE(SUM(o.quantity), 0) FROM orders o WHERE o.sales_person = sn.name AND o.order_type IN ('Demo', 'DEMO') AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS binh_demo,
    (SELECT COUNT(*) FROM cylinder_recoveries cr JOIN customers c ON c.id = cr.customer_id WHERE c.care_by = sn.name AND cr.status = 'HOAN_THANH') AS don_thu_hoi,
    (SELECT COALESCE(SUM(cr.total_items), 0) FROM cylinder_recoveries cr JOIN customers c ON c.id = cr.customer_id WHERE c.care_by = sn.name AND cr.status = 'HOAN_THANH') AS binh_thu_hoi,
    (SELECT COUNT(*) FROM machines m JOIN customers c ON c.name = m.customer_name WHERE c.care_by = sn.name AND m.status = 'thuộc khách hàng') AS may_ban,
    (SELECT COUNT(*) FROM machines m JOIN customers c ON c.name = m.customer_name WHERE c.care_by = sn.name AND m.status = 'đang sử dụng') AS may_dang_su_dung,
    (SELECT COALESCE(SUM(inv.quantity), 0) FROM inventory inv WHERE inv.item_type = 'BINH' AND inv.warehouse_id IN (SELECT DISTINCT warehouse_id FROM customers WHERE care_by = sn.name)) AS binh_ton_kho
FROM salesperson_names sn
LEFT JOIN app_users u ON u.name = sn.name
WHERE (u.role IS NULL OR u.role NOT IN ('Admin', 'admin'));

-- 3. view_cylinder_expiry
CREATE OR REPLACE VIEW view_cylinder_expiry AS
SELECT 
    cy.id,
    cy.serial_number AS ma_binh,
    cy.cylinder_code AS ma_khac_tren_vo,
    cy.category AS loai_binh,
    cy.volume AS the_tich,
    cy.gas_type AS loai_khi,
    cy.status AS trang_thai,
    cy.customer_name AS khach_hang,
    cy.expiry_date AS ngay_het_han,
    GREATEST(0, CURRENT_DATE - cy.expiry_date) AS so_ngay_ton,
    c.care_by AS nhan_vien_kin_doanh,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END AS kho
FROM cylinders cy
LEFT JOIN customers c ON c.name = cy.customer_name
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
WHERE cy.expiry_date IS NOT NULL AND cy.expiry_date < CURRENT_DATE;

-- 4. view_customer_expiry
CREATE OR REPLACE VIEW view_customer_expiry AS
SELECT 
    c.id,
    c.ma_khach_hang,
    c.ten_khach_hang,
    c.kho,
    c.loai_khach,
    c.ngay_dat_hang_gan_nhat,
    GREATEST(0, CURRENT_DATE - c.ngay_dat_hang_gan_nhat) AS so_ngay_chua_phat_sinh,
    (SELECT order_code FROM orders WHERE customer_name = c.ten_khach_hang ORDER BY created_at DESC LIMIT 1) AS ma_don_gan_nhat,
    c.binh_hien_co AS binh_ton,
    c.may_dang_su_dung,
    c.danh_sach_binh,
    c.danh_sach_may,
    c.nhan_vien_kin_doanh
FROM view_customer_stats c
WHERE c.ngay_dat_hang_gan_nhat IS NOT NULL AND c.ngay_dat_hang_gan_nhat < CURRENT_DATE - INTERVAL '30 days';

-- 5. view_cylinder_errors
CREATE OR REPLACE VIEW view_cylinder_errors AS
SELECT 
    cy.id,
    cy.serial_number AS ma_binh,
    cy.cylinder_code AS ma_khac_tren_vo,
    cy.category AS loai_binh,
    cy.volume AS the_tich,
    cy.gas_type AS loai_khi,
    cy.status AS trang_thai,
    cy.error_reason AS ly_do_loi,
    cy.customer_name AS khach_hang,
    cy.updated_at AS ngay_phat_hien_loi,
    cy.error_fixed_date AS ngay_sua_xong,
    cy.error_reported_by AS nguoi_bao_loi,
    GREATEST(0, CURRENT_DATE - cy.updated_at::DATE) AS so_ngay_chua_sua,
    CASE WHEN cy.error_fixed_date IS NOT NULL THEN cy.error_fixed_date - cy.updated_at::DATE ELSE NULL END AS thoi_gian_xu_ly_ngay,
    c.care_by AS nhan_vien_kin_doanh,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END AS kho
FROM cylinders cy
LEFT JOIN customers c ON c.name = cy.customer_name
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
WHERE cy.status = 'hỏng';

-- 6. view_machine_summary
CREATE OR REPLACE VIEW view_machine_summary AS
SELECT 
    m.machine_type AS loai_may,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END::VARCHAR(50) AS kho,
    COUNT(*) AS tong_so_may,
    COUNT(CASE WHEN m.status = 'thuộc khách hàng' THEN 1 END) AS may_ban,
    COUNT(CASE WHEN m.status = 'sẵn sàng' AND m.customer_name IS NULL THEN 1 END) AS may_ton_kho,
    COUNT(CASE WHEN m.status = 'bảo trì' THEN 1 END) AS may_bao_tri,
    COUNT(CASE WHEN m.status = 'đang sửa' THEN 1 END) AS may_sua_chua,
    COUNT(CASE WHEN m.status = 'đang sử dụng' THEN 1 END) AS may_dang_su_dung
FROM machines m
LEFT JOIN warehouses w ON (w.id::text = m.warehouse OR w.name = m.warehouse)
GROUP BY m.machine_type, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END;

-- 7. view_machine_revenue
CREATE OR REPLACE VIEW view_machine_revenue AS
SELECT 
    m.machine_type AS loai_may,
    m.serial_number AS serial_may,
    m.customer_name AS khach_hang,
    m.department_in_charge AS khoa,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END::VARCHAR(50) AS kho,
    c.customer_type AS loai_khach_hang,
    c.care_by AS nhan_vien_kin_doanh,
    COUNT(o.id) AS so_don_hang,
    COALESCE(SUM(o.total_amount), 0) AS tong_doanh_so
FROM machines m
LEFT JOIN orders o ON o.customer_name = m.customer_name 
    AND o.product_type LIKE '%' || m.machine_type || '%'
    AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
LEFT JOIN customers c ON c.name = m.customer_name
LEFT JOIN warehouses w ON (w.id::text = m.warehouse OR w.name = m.warehouse)
GROUP BY m.machine_type, m.serial_number, m.customer_name, m.department_in_charge, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END, 
    c.customer_type, c.care_by;

-- 8. view_orders_monthly
CREATE OR REPLACE VIEW view_orders_monthly AS
SELECT 
    o.id,
    o.order_code AS ma_don,
    o.customer_category AS loai_khach_hang,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN o.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN o.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN o.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN o.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE o.warehouse 
    END::VARCHAR(50) AS kho,
    o.customer_name AS ten_khach_hang,
    o.order_type AS loai_don,
    o.quantity AS so_luong,
    o.total_amount AS thanh_tien,
    o.status AS trang_thai,
    o.sales_person AS nhan_vien_kin_doanh,
    o.created_at AS ngay_tao,
    EXTRACT(YEAR FROM o.created_at)::INT AS nam,
    EXTRACT(MONTH FROM o.created_at)::INT AS thang
FROM orders o
LEFT JOIN warehouses w ON (w.id::text = o.warehouse OR w.name = o.warehouse)
WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH');

-- 9. view_dashboard_summary
CREATE OR REPLACE VIEW view_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM customers) AS tong_khach_hang,
    (SELECT COUNT(*) FROM orders WHERE status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS tong_don_hang,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_type IN ('THUONG', 'BAN', 'THUE', 'Xuất bán') AND status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS tong_doanh_thu,
    (SELECT COUNT(*) FROM cylinders WHERE status = 'sẵn sàng') AS binh_ton_kho,
    (SELECT COUNT(*) FROM machines WHERE status = 'sẵn sàng') AS may_ton_kho,
    (SELECT COUNT(*) FROM customers WHERE last_order_date < CURRENT_DATE - INTERVAL '30 days' AND last_order_date IS NOT NULL) AS khach_hang_qua_han;

-- 10. view_customer_cylinder_movements (Dependency)
CREATE OR REPLACE VIEW view_customer_cylinder_movements AS
WITH monthly_movements AS (
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.warehouse_id as kho_src,
        c.category as loai_khach,
        EXTRACT(YEAR FROM o.created_at)::int as nam,
        EXTRACT(MONTH FROM o.created_at)::int as thang,
        SUM(o.quantity) as xuat,
        0 as thu_hoi
    FROM orders o
    JOIN customers c ON c.name = o.customer_name
    WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
    GROUP BY c.id, c.name, c.warehouse_id, c.category, nam, thang
    UNION ALL
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.warehouse_id as kho_src,
        c.category as loai_khach,
        EXTRACT(YEAR FROM cr.created_at)::int as nam,
        EXTRACT(MONTH FROM cr.created_at)::int as thang,
        0 as xuat,
        SUM(cr.total_items) as thu_hoi
    FROM cylinder_recoveries cr
    JOIN customers c ON c.id = cr.customer_id
    WHERE cr.status = 'HOAN_THANH'
    GROUP BY c.id, c.name, c.warehouse_id, c.category, nam, thang
)
SELECT 
    m.customer_id,
    m.customer_name,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.kho_src = 'HN' THEN 'Kho Hà Nội'
        WHEN m.kho_src = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.kho_src = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.kho_src = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.kho_src 
    END::VARCHAR(50) AS kho,
    m.loai_khach,
    m.nam,
    m.thang,
    SUM(m.xuat) as xuat,
    SUM(m.thu_hoi) as thu_hoi,
    SUM(m.xuat - m.thu_hoi) as chenh_lech
FROM monthly_movements m
LEFT JOIN warehouses w ON (w.id::text = m.kho_src OR w.name = m.kho_src)
GROUP BY m.customer_id, m.customer_name, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.kho_src = 'HN' THEN 'Kho Hà Nội'
        WHEN m.kho_src = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.kho_src = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.kho_src = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.kho_src 
    END, 
    m.loai_khach, m.nam, m.thang;

-- 11. view_customer_cylinder_monthly_balance
CREATE OR REPLACE VIEW view_customer_cylinder_monthly_balance AS
SELECT 
    m.*,
    SUM(m.chenh_lech) OVER (PARTITION BY m.customer_id ORDER BY m.nam, m.thang) as closing_balance,
    (SUM(m.chenh_lech) OVER (PARTITION BY m.customer_id ORDER BY m.nam, m.thang)) - m.chenh_lech as opening_balance
FROM view_customer_cylinder_movements m;

-- 12. view_machine_movements_combined (Dependency)
CREATE OR REPLACE VIEW view_machine_movements_combined AS
WITH movements AS (
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        o.warehouse as warehouse_id,
        EXTRACT(YEAR FROM o.created_at)::int as nam,
        EXTRACT(MONTH FROM o.created_at)::int as thang,
        o.quantity as xuat,
        0 as thu_hoi
    FROM orders o
    JOIN customers c ON c.name = o.customer_name
    WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH') 
      AND (o.product_type LIKE '%MAY%' OR o.product_type = 'MAY')
    UNION ALL
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        gr.warehouse_id as warehouse_id,
        EXTRACT(YEAR FROM gr.receipt_date)::int as nam,
        EXTRACT(MONTH FROM gr.receipt_date)::int as thang,
        0 as xuat,
        gri.quantity as thu_hoi
    FROM goods_receipts gr
    JOIN goods_receipt_items gri ON gri.receipt_id = gr.id
    JOIN customers c ON c.name = gr.supplier_name
    WHERE gr.status = 'DA_NHAP' AND gri.item_type = 'MAY'
)
SELECT 
    m.customer_id,
    m.customer_name,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse_id 
    END::VARCHAR(50) AS kho,
    m.nam,
    m.thang,
    SUM(m.xuat) as xuat,
    SUM(m.thu_hoi) as thu_hoi,
    SUM(m.xuat - m.thu_hoi) as chenh_lech
FROM movements m
LEFT JOIN warehouses w ON (w.id::text = m.warehouse_id OR w.name = m.warehouse_id)
GROUP BY m.customer_id, m.customer_name, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse_id 
    END, 
    m.nam, m.thang;

-- 13. view_machine_monthly_balance
CREATE OR REPLACE VIEW view_machine_monthly_balance AS
SELECT 
    m.*,
    SUM(m.chenh_lech) OVER (PARTITION BY m.customer_id ORDER BY m.nam, m.thang) as closing_balance,
    (SUM(m.chenh_lech) OVER (PARTITION BY m.customer_id ORDER BY m.nam, m.thang)) - m.chenh_lech as opening_balance
FROM view_machine_movements_combined m;

-- 14. view_error_summary_monthly
CREATE OR REPLACE VIEW view_error_summary_monthly AS
SELECT 
    rt.id,
    rt.stt,
    rt.date AS ngay_bao_loi,
    rt.loai_loi AS error_category,
    ret.name AS ten_loi,
    rt.machine_serial AS serial_thiet_bi,
    rt.machine_name AS ten_thiet_bi,
    c.name AS ten_khach_hang,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END::VARCHAR(50) AS kho,
    c.category AS loai_khach,
    u_created.name AS nguoi_bao_loi,
    u_tech.name AS ky_thuat_xu_ly,
    rt.status AS trang_thai_phieu,
    rt.error_details AS mo_ta_chi_tiet,
    DATE_TRUNC('month', rt.date)::DATE AS thang_nam,
    EXTRACT(YEAR FROM rt.date) AS nam,
    EXTRACT(MONTH FROM rt.date) AS thang,
    EXTRACT(QUARTER FROM rt.date) AS quy
FROM repair_tickets rt
LEFT JOIN repair_error_types ret ON ret.id = rt.error_type_id
LEFT JOIN customers c ON c.id = rt.customer_id
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
LEFT JOIN app_users u_created ON u_created.id = rt.created_by
LEFT JOIN app_users u_tech ON u_tech.id = rt.technician_id;

-- 15. view_machine_stats
CREATE OR REPLACE VIEW view_machine_stats AS
SELECT 
    m.id,
    m.serial_number AS serial_may,
    m.machine_type AS loai_may,
    m.status AS trang_thai,
    m.customer_name AS khach_hang,
    m.department_in_charge AS khoa_phu_trach,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END::VARCHAR(50) AS kho,
    m.gas_type AS loai_khi,
    m.maintenance_date AS ngay_bao_tri_gan_nhat,
    m.maintenance_type AS loai_bao_tri,
    m.next_maintenance_date AS ngay_bao_tri_tiep,
    m.maintenance_by AS nguoi_bao_tri,
    c.care_by AS nhan_vien_kin_doanh,
    CASE WHEN m.status = 'thuộc khách hàng' THEN 1 ELSE 0 END AS is_ban,
    CASE WHEN m.status = 'sẵn sàng' AND m.customer_name IS NULL THEN 1 ELSE 0 END AS is_ton_kho,
    CASE WHEN m.status = 'bảo trì' THEN 1 ELSE 0 END AS is_bao_tri,
    CASE WHEN m.status = 'đang sửa' THEN 1 ELSE 0 END AS is_sua_chua
FROM machines m
LEFT JOIN customers c ON c.name = m.customer_name
LEFT JOIN warehouses w ON (w.id::text = m.warehouse OR w.name = m.warehouse);

-- 16. view_sales_summary_monthly
CREATE OR REPLACE VIEW view_sales_summary_monthly AS
SELECT 
    c.name as customer_name,
    c.care_by as nvkd,
    c.category as loai_khach,
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END::VARCHAR(50) AS kho,
    EXTRACT(MONTH FROM o.created_at) as thang,
    EXTRACT(YEAR FROM o.created_at) as nam,
    SUM(o.total_amount) as doanh_so,
    COUNT(o.id) as so_don_hang
FROM orders o
JOIN customers c ON c.name = o.customer_name
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id)
WHERE o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
GROUP BY c.name, c.care_by, c.category, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
        WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
        WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
        ELSE c.warehouse_id 
    END, 
    nam, thang;
