-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLE: repair_error_types
-- ==========================================
CREATE TABLE IF NOT EXISTS public.repair_error_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for repair_error_types
ALTER TABLE public.repair_error_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép tất cả người dùng xem loại lỗi"
    ON public.repair_error_types FOR SELECT
    USING (true);

CREATE POLICY "Cho phép người dùng thêm loại lỗi mới"
    ON public.repair_error_types FOR INSERT
    WITH CHECK (true);
    
CREATE POLICY "Cho phép người dùng cập nhật loại lỗi"
    ON public.repair_error_types FOR UPDATE
    USING (true);

-- ==========================================
-- TABLE: repair_tickets (Phiếu sửa chữa)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.repair_tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stt SERIAL,
    date DATE DEFAULT CURRENT_DATE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    machine_serial VARCHAR(255),
    machine_name VARCHAR(255),
    error_type_id UUID REFERENCES public.repair_error_types(id) ON DELETE SET NULL,
    error_details TEXT,
    error_images TEXT[],
    sales_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    technician_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    technical_feedback TEXT,
    technical_images TEXT[],
    status VARCHAR(50) DEFAULT 'Mới',
    created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_repair_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_repair_tickets_updated_at ON public.repair_tickets;
CREATE TRIGGER trg_repair_tickets_updated_at
BEFORE UPDATE ON public.repair_tickets
FOR EACH ROW
EXECUTE FUNCTION update_repair_tickets_updated_at();

-- RLS Policies for repair_tickets
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép xem phiếu sửa chữa"
    ON public.repair_tickets FOR SELECT
    USING (true);

CREATE POLICY "Cho phép tạo phiếu sửa chữa"
    ON public.repair_tickets FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Cho phép cập nhật phiếu sửa chữa"
    ON public.repair_tickets FOR UPDATE
    USING (true);

CREATE POLICY "Cho phép xóa phiếu sửa chữa (chỉ admin)"
    ON public.repair_tickets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.id = auth.uid() AND app_users.role = 'admin'
        )
    );

-- Create storage bucket for repair ticket images if it doesn't exist
-- Note: Requires Supabase admin privileges, alternatively do this in the dashboard
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repair-tickets', 'repair-tickets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (Requires executing as superuser in Supabase SQL editor)
-- CREATE POLICY "Cho phép xem ảnh public" ON storage.objects FOR SELECT USING (bucket_id = 'repair-tickets');
-- CREATE POLICY "Cho phép upload ảnh" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'repair-tickets');
-- CREATE POLICY "Cho phép xóa ảnh" ON storage.objects FOR DELETE USING (bucket_id = 'repair-tickets');
