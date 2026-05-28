-- Chạy file này trên Supabase SQL Editor nếu app báo thiếu cột app_users
-- (PostgREST: "Could not find the '...' column ... in the schema cache")
-- Sau khi chạy: đợi ~1 phút hoặc Settings → API → Reload schema (nếu có)

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sales_group TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS nguoi_quan_ly TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS chi_nhanh TEXT;

COMMENT ON COLUMN app_users.password IS 'Mật khẩu đăng nhập (bcrypt hash)';
COMMENT ON COLUMN app_users.department IS 'Phòng ban';
COMMENT ON COLUMN app_users.sales_group IS 'Nhóm kinh doanh';
COMMENT ON COLUMN app_users.nguoi_quan_ly IS 'Người quản lý (có thể nhiều tên, phân tách bằng dấu phẩy)';
COMMENT ON COLUMN app_users.team IS 'Mã/nhóm team';
COMMENT ON COLUMN app_users.chi_nhanh IS 'Chi nhánh';

-- Tùy chọn: xóa cột legacy (đã bỏ trên app)
ALTER TABLE app_users DROP COLUMN IF EXISTS approval_level;

-- Nếu lỗi RLS khi thêm/sửa user: chạy thêm fix_app_users_rls.sql
