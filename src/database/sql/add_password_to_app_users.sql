-- Migration: Add password column to app_users table
-- Purpose: Security implementation for user login

-- 1. Add password column if it doesn't exist
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Update comments
COMMENT ON COLUMN app_users.password IS 'Mật khẩu đã được mã hóa bằng bcrypt';

-- 3. Set a default password for existing users to prevent null issues if needed
-- Here we'll just leave it NULL and handle the lack of password in the login logic, 
-- or you can manually set a temporary password for existing users later.
