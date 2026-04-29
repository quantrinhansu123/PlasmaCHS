-- Chi nhánh (branch) for user records — used on /nguoi-dung
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS chi_nhanh TEXT;

COMMENT ON COLUMN app_users.chi_nhanh IS 'Chi nhánh / kho làm việc (text tự do hoặc khớp warehouses.branch_office)';
