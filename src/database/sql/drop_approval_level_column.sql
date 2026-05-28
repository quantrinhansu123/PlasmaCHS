-- Remove legacy approval_level from app_users (replaced by role + phân quyền module)
ALTER TABLE app_users DROP COLUMN IF EXISTS approval_level;
