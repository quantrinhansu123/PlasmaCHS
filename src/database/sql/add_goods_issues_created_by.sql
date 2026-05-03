-- Người tạo phiếu xuất (xuất trả NCC ...)
ALTER TABLE goods_issues
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

COMMENT ON COLUMN goods_issues.created_by IS 'Người tạo phiếu — tên hoặc email người dùng đăng nhập';
