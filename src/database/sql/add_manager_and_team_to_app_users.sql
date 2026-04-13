-- Add manager and team metadata for user management
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS nguoi_quan_ly TEXT;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS team TEXT;

