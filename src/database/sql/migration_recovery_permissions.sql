-- ==============================================================================
-- MIGRATION: Cấp quyền Thu hồi vỏ cho tất cả các vai trò
-- DESCRIPTION: Đảm bảo mọi người dùng (NVKD, ThuKho, CSKH, QuanLy, Shipper) 
--              đều có quyền Xem và Tạo phiếu thu hồi vỏ bình.
-- ==============================================================================

-- 1. Cập nhật quyền cho tất cả các vai trò hiện có
DO $$ 
DECLARE 
    role_record RECORD;
    new_perms JSONB;
BEGIN 
    FOR role_record IN SELECT name, permissions FROM app_roles LOOP
        -- Thêm hoặc cập nhật quyền cylinder_recoveries
        new_perms = role_record.permissions || 
                    jsonb_build_object('cylinder_recoveries', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', (role_record.name = 'Admin')));
        
        -- Thêm hoặc cập nhật quyền machine_recoveries
        new_perms = new_perms || 
                    jsonb_build_object('machine_recoveries', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', (role_record.name = 'Admin')));

        -- Cập nhật vào database
        UPDATE app_roles 
        SET permissions = new_perms,
            updated_at = NOW()
        WHERE name = role_record.name;
    END LOOP;

    RAISE NOTICE 'Đã cấp quyền Thu hồi (Vỏ & Máy) cho tất cả các vai trò!'; 
END $$;
