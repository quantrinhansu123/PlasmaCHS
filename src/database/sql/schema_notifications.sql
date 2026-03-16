-- SQL Schema for PlasmaVN Notifications
-- Created: 2026-03-16

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT, -- Optional link to navigate to (e.g., /don-hang?code=804)
    user_id UUID, -- Optional: Target user. If NULL, it could be a global notification or for all admins.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Comment
COMMENT ON TABLE notifications IS 'Bảng lưu trữ thông báo hệ thống PlasmaVN';
