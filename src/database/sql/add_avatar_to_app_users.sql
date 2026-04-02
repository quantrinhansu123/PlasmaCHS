-- ==============================================================================
-- MIGRATION: Bổ sung trường Ảnh đại diện cho nhân sự
-- DESCRIPTION: Thêm cột avatar_url vào bảng app_users để lưu trữ link ảnh.
-- ==============================================================================

-- 1. Thêm cột avatar_url nếu chưa tồn tại
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Thêm bình luận mô tả
COMMENT ON COLUMN app_users.avatar_url IS 'Đường dẫn liên kết hoặc dữ liệu ảnh đại diện (Base64) của nhân viên';

-- In thông báo thành công
DO $$ 
BEGIN 
  RAISE NOTICE 'Đã bổ sung cột avatar_url vào bảng app_users thành công!'; 
END $$;
