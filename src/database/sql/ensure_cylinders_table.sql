-- =============================================================================
-- TẠO / BỔ SUNG bảng public.cylinders (chạy 1 lần trên Supabase SQL Editor)
-- Dùng khi lỗi: relation "cylinders" does not exist
--
-- QUAN TRỌNG: So sánh Supabase → Settings → API URL với VITE_SUPABASE_URL trong .env
-- Nếu app /binh đã có hàng trăm bình mà script tạo bảng RỖNG → sai project!
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bảng cylinders (không DROP)
CREATE TABLE IF NOT EXISTS public.cylinders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'sẵn sàng',
    net_weight NUMERIC(10, 2),
    category VARCHAR(50) NOT NULL DEFAULT 'BV',
    volume VARCHAR(100),
    gas_type VARCHAR(100),
    valve_type VARCHAR(100),
    handle_type VARCHAR(100),
    customer_id UUID,
    customer_name VARCHAR(255),
    cylinder_code VARCHAR(100),
    expiry_date DATE,
    error_reason TEXT,
    error_fixed_date DATE,
    error_reported_by VARCHAR(255),
    warehouse_id TEXT,
    supplier_id UUID,
    customer_assigned_at TIMESTAMPTZ,
    last_log_image TEXT,
    nha_may BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE serial_number
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.cylinders'::regclass
          AND conname = 'cylinders_serial_number_key'
    ) THEN
        ALTER TABLE public.cylinders
            ADD CONSTRAINT cylinders_serial_number_key UNIQUE (serial_number);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Cột thiếu (DB cũ)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'customer_id') THEN
        ALTER TABLE public.cylinders ADD COLUMN customer_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse_id') THEN
        ALTER TABLE public.cylinders ADD COLUMN warehouse_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'supplier_id') THEN
        ALTER TABLE public.cylinders ADD COLUMN supplier_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'customer_assigned_at') THEN
        ALTER TABLE public.cylinders ADD COLUMN customer_assigned_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'last_log_image') THEN
        ALTER TABLE public.cylinders ADD COLUMN last_log_image TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'nha_may') THEN
        ALTER TABLE public.cylinders ADD COLUMN nha_may BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- FK supplier_id → suppliers (nếu bảng suppliers đã có)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'suppliers'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.cylinders'::regclass
          AND conname = 'cylinders_supplier_id_fkey'
    ) THEN
        ALTER TABLE public.cylinders
            ADD CONSTRAINT cylinders_supplier_id_fkey
            FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.cylinders IS 'Danh sách vỏ bình /binh';
COMMENT ON COLUMN public.cylinders.supplier_id IS 'NCC nhận vỏ khi status = đã trả ncc';
COMMENT ON COLUMN public.cylinders.nha_may IS 'TRUE = bình đang ở kho nhà máy (NM)';

CREATE INDEX IF NOT EXISTS idx_cylinders_supplier_id
    ON public.cylinders (supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cylinders_nha_may
    ON public.cylinders (nha_may) WHERE nha_may = TRUE;

CREATE INDEX IF NOT EXISTS idx_cylinders_status ON public.cylinders (status);
CREATE INDEX IF NOT EXISTS idx_cylinders_warehouse_id ON public.cylinders (warehouse_id);

-- Bật RLS (tuỳ chọn — nếu project đã có policy thì giữ nguyên)
ALTER TABLE public.cylinders ENABLE ROW LEVEL SECURITY;

-- Kiểm tra sau khi chạy:
SELECT
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cylinders') AS has_cylinders_table,
    (SELECT COUNT(*)::int FROM public.cylinders) AS row_count;
