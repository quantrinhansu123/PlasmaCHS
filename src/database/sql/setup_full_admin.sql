-- ==============================================================================
-- SETUP: Tạo tài khoản SUPER ADMIN với đầy đủ quyền hạn
-- ==============================================================================

-- 1. Đảm bảo Nhóm quyền 'Admin' có TOÀN QUYỀN trên tất cả các phân hệ
INSERT INTO app_roles (name, permissions, type)
VALUES (
    'Admin',
    '{
        "dashboard": {"view": true, "create": true, "edit": true, "delete": true},
        "orders": {"view": true, "create": true, "edit": true, "delete": true},
        "customers": {"view": true, "create": true, "edit": true, "delete": true},
        "machines": {"view": true, "create": true, "edit": true, "delete": true},
        "cylinders": {"view": true, "create": true, "edit": true, "delete": true},
        "warehouses": {"view": true, "create": true, "edit": true, "delete": true},
        "suppliers": {"view": true, "create": true, "edit": true, "delete": true},
        "shippers": {"view": true, "create": true, "edit": true, "delete": true},
        "materials": {"view": true, "create": true, "edit": true, "delete": true},
        "promotions": {"view": true, "create": true, "edit": true, "delete": true},
        "users": {"view": true, "create": true, "edit": true, "delete": true},
        "permissions": {"view": true, "create": true, "edit": true, "delete": true}
    }'::jsonb,
    'group'
)
ON CONFLICT (name) DO UPDATE 
SET permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- 2. Tạo hoặc Cập nhật tài khoản User 'admin'
-- Mật khẩu mặc định: admin123
INSERT INTO app_users (name, username, role, phone, department, sales_group, approval_level, status, password)
VALUES (
    'Quản trị tối cao',
    'admin',
    'Admin',
    '0988888888',
    'Ban Giám Đốc',
    'Hệ thống',
    'Admin',
    'Hoạt động',
    '$2a$10$86/5l4K5L9O7b8V9B0N1M2Q3W4E5R6T7Y8U9I0O1P2A3S4D5F6G7H8' -- Hash của admin123
)
ON CONFLICT (username) DO UPDATE 
SET role = 'Admin', 
    approval_level = 'Admin',
    status = 'Hoạt động',
    password = EXCLUDED.password;

-- Thông báo
DO $$ 
BEGIN 
  RAISE NOTICE 'Đã thiết lập tài khoản admin (pass: admin123) với FULL QUYỀN.'; 
END $$;
