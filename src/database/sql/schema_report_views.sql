-- ==============================================================================
-- SQL Views for Reports - PlasmaVN
-- Purpose: Pre-calculated views for faster reporting
-- ==============================================================================

-- Drop existing views to avoid type mismatch errors (e.g. integer to bigint)
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

-- ==============================================================================
-- View: Thống kê theo khách hàng
-- Tiêu chí: Tên KH, loại KH (công/tư), kho, máy đang dùng, bình xuất, bán, demo, vỏ thu hồi, bình tồn
-- ==============================================================================
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
    
    -- Số bình xuất (tất cả đơn đã duyệt)
    COALESCE((
        SELECT SUM(o.quantity) 
        FROM orders o 
        WHERE o.customer_name = c.name 
        AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
    ), 0) AS binh_xuat,
    
    -- Số bình bán (đơn xuất bán)
    COALESCE((
        SELECT SUM(o.quantity) 
        FROM orders o 
        WHERE o.customer_name = c.name 
        AND o.order_type = 'Xuất bán'
        AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
    ), 0) AS binh_ban,
    
    -- Số bình demo
    COALESCE((
        SELECT SUM(o.quantity) 
        FROM orders o 
        WHERE o.customer_name = c.name 
        AND o.order_type = 'Demo'
        AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
    ), 0) AS binh_demo,
    
    -- Số vỏ thu hồi
    COALESCE((
        SELECT SUM(cri.total_items)
        FROM cylinder_recoveries cri
        JOIN customers c2 ON c2.id = cri.customer_id
        WHERE c2.id = c.id
        AND cri.status = 'HOAN_THANH'
    ), 0) AS vo_thu_hoi,
    
    -- NVKD phụ trách
    c.care_by AS nhan_vien_kinh_doanh,
    c.last_order_date AS ngay_dat_hang_gan_nhat,
    c.machines_in_use AS danh_sach_may,
    (SELECT STRING_AGG(serial_number, ', ') FROM cylinders cy WHERE cy.customer_name = c.name) AS danh_sach_binh
    
FROM customers c
LEFT JOIN warehouses w ON (w.id::text = c.warehouse_id OR w.name = c.warehouse_id);

-- ==============================================================================
-- View: Thống kê theo nhân viên kinh doanh
-- Tiêu chí: Tên NV, SĐT, tổng KH, đơn xuất bán, số bình bán, đơn demo, số bình demo, đơn thu hồi, bình thu hồi, tồn kho
-- ==============================================================================
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
    
    -- Tổng số khách hàng phụ trách
    (SELECT COUNT(*) FROM customers c WHERE c.care_by = sn.name) AS tong_khach_hang,
    
    -- Tổng đơn xuất bán
    (SELECT COUNT(*) FROM orders o WHERE o.sales_person = sn.name AND o.order_type = 'Xuất bán' AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS don_xuat_ban,
    
    -- Số bình bán
    (SELECT COALESCE(SUM(o.quantity), 0) FROM orders o WHERE o.sales_person = sn.name AND o.order_type = 'Xuất bán' AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS binh_ban,
    
    -- Tổng đơn demo
    (SELECT COUNT(*) FROM orders o WHERE o.sales_person = sn.name AND o.order_type = 'Demo' AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS don_demo,
    
    -- Số bình demo
    (SELECT COALESCE(SUM(o.quantity), 0) FROM orders o WHERE o.sales_person = sn.name AND o.order_type = 'Demo' AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')) AS binh_demo,
    
    -- Tổng đơn thu hồi
    (SELECT COUNT(*) FROM cylinder_recoveries cr JOIN customers c ON c.id = cr.customer_id WHERE c.care_by = sn.name AND cr.status = 'HOAN_THANH') AS don_thu_hoi,
    
    -- Số bình thu hồi
    (SELECT COALESCE(SUM(cr.total_items), 0) FROM cylinder_recoveries cr JOIN customers c ON c.id = cr.customer_id WHERE c.care_by = sn.name AND cr.status = 'HOAN_THANH') AS binh_thu_hoi,
    
    -- Số máy bán (thuộc khách hàng)
    (SELECT COUNT(*) FROM machines m JOIN customers c ON c.name = m.customer_name WHERE c.care_by = sn.name AND m.status = 'thuộc khách hàng') AS may_ban,
    
    -- Số máy đang sử dụng (cho thuê/demo)
    (SELECT COUNT(*) FROM machines m JOIN customers c ON c.name = m.customer_name WHERE c.care_by = sn.name AND m.status = 'đang sử dụng') AS may_dang_su_dung,

    -- Tổng tồn kho (bình tại các kho mà nhân viên phụ trách KH)
    (SELECT COALESCE(SUM(inv.quantity), 0) FROM inventory inv WHERE inv.item_type = 'BINH' AND inv.warehouse_id IN (SELECT DISTINCT warehouse_id FROM customers WHERE care_by = sn.name)) AS binh_ton_kho
    
FROM salesperson_names sn
LEFT JOIN app_users u ON u.name = sn.name
WHERE (u.role IS NULL OR u.role NOT IN ('Admin', 'admin'));

-- ==============================================================================
-- View: Bình quá hạn
-- Tiêu chí: Mã bình, loại bình, khách hàng, NVKD, Số ngày tồn
-- ==============================================================================
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
    c.care_by AS nhan_vien_kinh_doanh,
    COALESCE(
        w_cyl.name,
        w_cust.name,
        CASE 
            WHEN c.warehouse_id = 'HN' THEN 'Kho Hà Nội'
            WHEN c.warehouse_id = 'TP.HCM' THEN 'Kho TP.HCM'
            WHEN c.warehouse_id = 'TH' THEN 'Kho Thanh Hóa'
            WHEN c.warehouse_id = 'DN' THEN 'Kho Đà Nẵng'
            ELSE c.warehouse_id 
        END
    ) AS kho
FROM cylinders cy
LEFT JOIN customers c ON c.name = cy.customer_name
LEFT JOIN warehouses w_cyl ON w_cyl.id = cy.warehouse_id
LEFT JOIN warehouses w_cust ON (w_cust.id::text = c.warehouse_id OR w_cust.name = c.warehouse_id)
WHERE cy.expiry_date IS NOT NULL;

-- ==============================================================================
-- View: Khách hàng quá hạn (chưa phát sinh đơn trong X ngày)
-- Tiêu chí: Tên KH, kho, số ngày chưa phát sinh, mã đơn gần nhất, số vỏ tồn
-- ==============================================================================
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
    c.nhan_vien_kinh_doanh
FROM view_customer_stats c
WHERE c.ngay_dat_hang_gan_nhat IS NOT NULL 
AND c.ngay_dat_hang_gan_nhat < CURRENT_DATE - INTERVAL '30 days';

-- ==============================================================================
-- View: Bình lỗi (status = 'hỏng')
-- Tiêu chí: Mã bình, loại bình, khách hàng, NVKD, Số ngày tồn
-- ==============================================================================
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
    CASE 
        WHEN cy.error_fixed_date IS NOT NULL 
        THEN cy.error_fixed_date - cy.updated_at::DATE 
        ELSE NULL 
    END AS thoi_gian_xu_ly_ngay,
    c.care_by AS nhan_vien_kinh_doanh,
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

-- ==============================================================================
-- View: Thống kê máy (bán/cho thuê/demo/thu hồi)
-- Tiêu chí: Số lượng máy theo trạng thái
-- ==============================================================================
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
    c.care_by AS nhan_vien_kinh_doanh,
    
    -- Phân loại theo trạng thái
    CASE WHEN m.status = 'thuộc khách hàng' THEN 1 ELSE 0 END AS is_ban,
    CASE WHEN m.status = 'sẵn sàng' AND m.customer_name IS NULL THEN 1 ELSE 0 END AS is_ton_kho,
    CASE WHEN m.status = 'bảo trì' THEN 1 ELSE 0 END AS is_bao_tri,
    CASE WHEN m.status = 'đang sửa' THEN 1 ELSE 0 END AS is_sua_chua
    
FROM machines m
LEFT JOIN customers c ON c.name = m.customer_name
LEFT JOIN warehouses w ON (w.id::text = m.warehouse OR w.name = m.warehouse);

-- ==============================================================================
-- View: Thống kê máy tổng hợp (theo loại và trạng thái)
-- ==============================================================================
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
    END::VARCHAR(50);

-- ==============================================================================
-- View: Đơn hàng theo tháng/năm
-- Tiêu chí: Chi tiết các đơn ĐNXM đã duyệt
-- ==============================================================================
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
    o.recipient_name AS nguoi_nhan,
    o.recipient_address AS dia_chi_nhan,
    o.order_type AS loai_don,
    o.product_type AS loai_hang,
    o.quantity AS so_luong,
    o.unit_price AS don_gia,
    o.total_amount AS thanh_tien,
    o.department AS khoa_su_dung,
    o.status AS trang_thai,
    o.sales_person AS nhan_vien_kinh_doanh,
    o.ordered_by AS nguoi_dat,
    o.created_at AS ngay_tao,
    DATE_TRUNC('month', o.created_at)::DATE AS thang_nam,
    EXTRACT(YEAR FROM o.created_at)::INT AS nam,
    EXTRACT(MONTH FROM o.created_at)::INT AS thang
FROM orders o
LEFT JOIN warehouses w ON (w.id::text = o.warehouse OR w.name = o.warehouse)
WHERE o.status IN (
    'DA_DUYET', 
    'CHO_GIAO_HANG', 
    'DANG_GIAO_HANG', 
    'CHO_DOI_SOAT', 
    'HOAN_THANH',
    'DOI_SOAT_THAT_BAI'
);

-- ==============================================================================
-- View: Dashboard tổng quan
-- ==============================================================================
CREATE OR REPLACE VIEW view_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM customers) AS tong_khach_hang,
    (SELECT COUNT(*) FROM orders WHERE status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'CHO_DOI_SOAT', 'HOAN_THANH', 'DOI_SOAT_THAT_BAI')) AS tong_don_hang,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_type = 'THUONG' AND status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'CHO_DOI_SOAT', 'HOAN_THANH', 'DOI_SOAT_THAT_BAI')) AS tong_doanh_thu,
    (SELECT COUNT(*) FROM cylinders WHERE status = 'sẵn sàng') AS binh_ton_kho,
    (SELECT COUNT(*) FROM cylinders WHERE status = 'hỏng') AS binh_loi,
    (SELECT COUNT(*) FROM machines WHERE status = 'sẵn sàng') AS may_ton_kho,
    (SELECT COUNT(*) FROM machines WHERE status = 'thuộc khách hàng') AS may_da_ban,
    (SELECT COUNT(*) FROM customers WHERE last_order_date < CURRENT_DATE - INTERVAL '30 days' AND last_order_date IS NOT NULL) AS khach_hang_qua_han,
    (SELECT COUNT(*) FROM cylinders WHERE expiry_date < CURRENT_DATE AND expiry_date IS NOT NULL) AS binh_qua_han;

-- ==============================================================================
-- View: Doanh số theo máy (theo khoa, NVKD, loại KH)
-- ==============================================================================
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
    c.care_by AS nhan_vien_kinh_doanh,
    COUNT(o.id) AS so_don_hang,
    COALESCE(SUM(o.total_amount), 0) AS tong_doanh_so
FROM machines m
LEFT JOIN orders o ON o.customer_name = m.customer_name 
    AND o.product_type LIKE '%' || m.machine_type || '%'
    AND o.status IN ('DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'HOAN_THANH')
LEFT JOIN customers c ON c.name = m.customer_name
LEFT JOIN warehouses w ON (w.id::text = m.warehouse OR w.name = m.warehouse)
GROUP BY m.id, m.machine_type, m.serial_number, m.customer_name, m.department_in_charge, 
    CASE 
        WHEN w.name IS NOT NULL THEN w.name
        WHEN m.warehouse = 'HN' THEN 'Kho Hà Nội'
        WHEN m.warehouse = 'TP.HCM' THEN 'Kho TP.HCM'
        WHEN m.warehouse = 'TH' THEN 'Kho Thanh Hóa'
        WHEN m.warehouse = 'DN' THEN 'Kho Đà Nẵng'
        ELSE m.warehouse 
    END, 
    c.customer_type, c.care_by;

-- ==============================================================================
-- Comments for views
-- ==============================================================================
COMMENT ON VIEW view_customer_stats IS 'Thống kê theo khách hàng: tên, loại KH, kho, máy, bình xuất, bán, demo, vỏ thu hồi, tồn';
COMMENT ON VIEW view_salesperson_stats IS 'Thống kê theo NVKD: tên, SĐT, tổng KH, đơn bán, bình bán, demo, thu hồi, tồn kho';
COMMENT ON VIEW view_cylinder_expiry IS 'Bình quá hạn: mã bình, loại, KH, NVKD, số ngày tồn';
COMMENT ON VIEW view_customer_expiry IS 'KH quá hạn: tên KH, kho, ngày chưa phát sinh, mã đơn gần nhất, vỏ tồn';
COMMENT ON VIEW view_cylinder_errors IS 'Bình lỗi: mã bình, loại lỗi, ngày phát hiện, người xử lý, thời gian xử lý';
COMMENT ON VIEW view_machine_stats IS 'Thống kê máy chi tiết: bán, cho thuê, demo, thu hồi';
COMMENT ON VIEW view_machine_summary IS 'Thống kê máy tổng hợp theo loại và kho';
COMMENT ON VIEW view_orders_monthly IS 'Đơn hàng theo tháng/năm đã duyệt';
COMMENT ON VIEW view_dashboard_summary IS 'Dashboard tổng quan: tổng KH, đơn, doanh thu, tồn kho';
COMMENT ON VIEW view_machine_revenue IS 'Doanh số theo máy: theo khoa, NVKD, loại KH';
