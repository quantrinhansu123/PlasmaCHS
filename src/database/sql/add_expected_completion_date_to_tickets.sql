-- Update repair_tickets table to support expected completion date
ALTER TABLE public.repair_tickets 
ADD COLUMN IF NOT EXISTS expected_completion_date DATE;

-- Add comment for clarity
COMMENT ON COLUMN public.repair_tickets.expected_completion_date IS 'Expected date for the repair to be completed';
