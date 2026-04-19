-- MIGRATION: Add 'đã trả ncc' to cylinder and machine status constraints
-- Purpose: Allow the "Return to Supplier" workflow to update asset statuses.
-- Run this in Supabase SQL Editor.
-- Date: 2026-04-20

BEGIN;

-- ==============================
-- FIX 1: cylinders table
-- ==============================
ALTER TABLE cylinders DROP CONSTRAINT IF EXISTS check_cylinder_status;

ALTER TABLE cylinders ADD CONSTRAINT check_cylinder_status CHECK (
    status IN (
        'sẵn sàng',
        'đang vận chuyển',
        'đang sử dụng',
        'đã sử dụng',
        'chờ nạp',
        'hỏng',
        'thuộc khách hàng',
        'bình rỗng',
        'đã trả ncc'   -- Thêm mới: trạng thái khi xuất trả nhà cung cấp
    )
);

-- ==============================
-- FIX 2: machines table
-- ==============================
ALTER TABLE machines DROP CONSTRAINT IF EXISTS check_machine_status;

ALTER TABLE machines ADD CONSTRAINT check_machine_status CHECK (
    status IN (
        'chưa xác định',
        'sẵn sàng',
        'thuộc khách hàng',
        'kiểm tra',
        'đang sửa',
        'bảo trì',
        'đã trả ncc'   -- Thêm mới: trạng thái khi xuất trả nhà cung cấp
    )
);

COMMIT;
