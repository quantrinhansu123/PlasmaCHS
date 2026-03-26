-- ==============================================================================
-- SQL Migration for User Schema Expansion
-- Adds Department, Sales Group, and Approval Levels
-- ==============================================================================

-- Add new columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='department') THEN
        ALTER TABLE app_users ADD COLUMN department TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='sales_group') THEN
        ALTER TABLE app_users ADD COLUMN sales_group TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='approval_level') THEN
        ALTER TABLE app_users ADD COLUMN approval_level TEXT DEFAULT 'Staff';
    END IF;
END $$;

-- Comment for documentation
COMMENT ON COLUMN app_users.department IS 'Phòng ban hoặc Đại lý mà nhân viên thuộc về';
COMMENT ON COLUMN app_users.sales_group IS 'Nhóm kinh doanh (để phân tích doanh số nhóm)';
COMMENT ON COLUMN app_users.approval_level IS 'Cấp bậc phê duyệt (Admin, Manager, Supervisor, Staff)';
