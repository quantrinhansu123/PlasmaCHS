-- NCC nhận vỏ (supplier_id) trên cylinders
-- Nếu lỗi "relation cylinders does not exist" → chạy file:
--   src/database/sql/ensure_cylinders_table.sql
-- (file đó tạo bảng + supplier_id + nha_may)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    warehouse_id TEXT,
    supplier_id UUID,
    nha_may BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cylinders
    ADD COLUMN IF NOT EXISTS supplier_id UUID;

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

COMMENT ON COLUMN public.cylinders.supplier_id IS
    'NCC nhận lại vỏ khi status = đã trả ncc; NULL khi bình ở kho/khách';

CREATE INDEX IF NOT EXISTS idx_cylinders_supplier_id
    ON public.cylinders (supplier_id) WHERE supplier_id IS NOT NULL;

SELECT COUNT(*)::int AS so_binh FROM public.cylinders;
