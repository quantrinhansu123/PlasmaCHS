-- Script to create cylinder_qc_records table in Supabase
-- This table stores quality control (QC) and technical metadata for cylinders from factory test reports.

CREATE TABLE IF NOT EXISTS public.cylinder_qc_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number VARCHAR(255) NOT NULL,
    batch_no VARCHAR(100),
    product_type VARCHAR(100),
    standard VARCHAR(100),
    material VARCHAR(100),
    empty_weight NUMERIC(10, 2), -- in kg
    water_capacity NUMERIC(10, 2), -- in Liters
    test_pressure VARCHAR(50), -- e.g. 15MPa
    hold_time VARCHAR(50), -- e.g. 0.5 min
    conclusion VARCHAR(50), -- e.g. OK
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure one active QC record per serial number
    CONSTRAINT unique_serial_number_qc UNIQUE (serial_number)
);

-- RLS Policies
ALTER TABLE public.cylinder_qc_records ENABLE ROW LEVEL SECURITY;

-- Drop restricted policy if it exists
DROP POLICY IF EXISTS "Allow authenticated full access to cylinder_qc_records" ON public.cylinder_qc_records;
DROP POLICY IF EXISTS "Allow all access to cylinder_qc_records" ON public.cylinder_qc_records;

-- Create an unrestricted policy for the app
CREATE POLICY "Allow all access to cylinder_qc_records" 
ON public.cylinder_qc_records 
FOR ALL 
USING (true)
WITH CHECK (true);


-- Adding an index on serial_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_cylinder_qc_serial ON public.cylinder_qc_records(serial_number);
