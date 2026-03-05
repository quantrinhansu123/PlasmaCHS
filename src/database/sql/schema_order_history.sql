-- SQL Schema for Order History / Audit Log
-- Bảng lưu lịch sử thay đổi đơn hàng (chỉnh sửa, duyệt, chuyển trạng thái)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,           -- 'CREATED', 'EDITED', 'STATUS_CHANGED'
    old_status VARCHAR(50),                -- Trạng thái cũ (khi STATUS_CHANGED)
    new_status VARCHAR(50),                -- Trạng thái mới (khi STATUS_CHANGED)
    changed_fields JSONB,                  -- {"field": {"old": "X", "new": "Y"}} (khi EDITED)
    reason TEXT,                            -- Lý do chỉnh sửa (bắt buộc khi EDITED)
    created_by VARCHAR(255) NOT NULL,      -- Người thực hiện
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE order_history IS 'Lịch sử thay đổi đơn hàng - audit trail';
COMMENT ON COLUMN order_history.action IS 'CREATED = Tạo mới, EDITED = Chỉnh sửa, STATUS_CHANGED = Đổi trạng thái';
COMMENT ON COLUMN order_history.changed_fields IS 'JSON chứa các trường đã thay đổi (old/new values)';
COMMENT ON COLUMN order_history.reason IS 'Bắt buộc nhập khi chỉnh sửa đơn hàng';
