-- Add branch_office column to warehouses table
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS branch_office VARCHAR(255);

-- Update existing records to use the warehouse name as a default branch name if empty
-- UPDATE warehouses SET branch_office = name WHERE branch_office IS NULL;

-- Comment for clarity
COMMENT ON COLUMN warehouses.branch_office IS 'Chi nhánh / Văn phòng đại diện (Đại lý)';
