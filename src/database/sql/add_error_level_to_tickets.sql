-- Add error_level column to repair_tickets table
ALTER TABLE public.repair_tickets 
ADD COLUMN IF NOT EXISTS error_level VARCHAR(50) DEFAULT 'Trung bình';

-- Add comment for clarity
COMMENT ON COLUMN public.repair_tickets.error_level IS 'Mức độ nghiêm trọng của lỗi (Thấp, Trung bình, Cao, Nghiêm trọng)';

-- Update existing records to reflect a default level if needed
UPDATE public.repair_tickets SET error_level = 'Trung bình' WHERE error_level IS NULL;
