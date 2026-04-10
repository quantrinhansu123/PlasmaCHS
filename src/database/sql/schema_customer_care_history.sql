-- Table to store history of staff caring for a customer
-- Useful for tracking Lead management transfers

CREATE TABLE IF NOT EXISTS customer_care_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_name VARCHAR(255) NOT NULL, -- Name of the personnel assigned
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE customer_care_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write
CREATE POLICY "Allow all users to read customer care history" ON customer_care_history FOR SELECT USING (true);
CREATE POLICY "Allow all users to insert customer care history" ON customer_care_history FOR INSERT WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_customer_care_history_customer_id ON customer_care_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_care_history_assigned_at ON customer_care_history(assigned_at DESC);

COMMENT ON TABLE customer_care_history IS 'Lịch sử nhân viên kinh doanh chăm sóc khách hàng';
