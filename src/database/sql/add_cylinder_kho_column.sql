-- Thêm cột kho (mã kho quản lý) trên public.cylinders
-- Chạy trên Supabase SQL Editor sau migrate_cylinder_warehouse_id_to_name.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.cylinders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'sẵn sàng',
    kho TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cylinders ADD COLUMN IF NOT EXISTS kho TEXT;

-- Đồng bộ từ warehouse / warehouse_id cũ (nếu có)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse'
    ) THEN
        EXECUTE $sql$
            UPDATE public.cylinders
            SET kho = COALESCE(NULLIF(trim(kho), ''), NULLIF(trim(warehouse), ''))
            WHERE status IS DISTINCT FROM 'đã trả ncc'
              AND (kho IS NULL OR trim(kho) = '')
              AND warehouse IS NOT NULL AND trim(warehouse) <> ''
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse_id'
    ) THEN
        EXECUTE $sql$
            UPDATE public.cylinders c
            SET kho = COALESCE(NULLIF(trim(c.kho), ''), w.name, w.code, trim(c.warehouse_id::text))
            FROM public.warehouses w
            WHERE c.status IS DISTINCT FROM 'đã trả ncc'
              AND (c.kho IS NULL OR trim(c.kho) = '')
              AND c.warehouse_id IS NOT NULL
              AND trim(c.warehouse_id::text) <> ''
              AND (
                w.id::text = trim(c.warehouse_id::text)
                OR lower(trim(w.code)) = lower(trim(c.warehouse_id::text))
                OR lower(trim(w.name)) = lower(trim(c.warehouse_id::text))
              )
        $sql$;

        EXECUTE $sql$
            UPDATE public.cylinders
            SET kho = trim(warehouse_id::text)
            WHERE status IS DISTINCT FROM 'đã trả ncc'
              AND (kho IS NULL OR trim(kho) = '')
              AND warehouse_id IS NOT NULL AND trim(warehouse_id::text) <> ''
        $sql$;
    END IF;
END $$;

-- Gán OCP1 cho mọi bình (trừ đã trả NCC) — ghi đè giá trị cũ
UPDATE public.cylinders
SET kho = 'OCP1', updated_at = NOW()
WHERE status IS DISTINCT FROM 'đã trả ncc';

UPDATE public.cylinders
SET kho = NULL, updated_at = NOW()
WHERE status = 'đã trả ncc';

CREATE INDEX IF NOT EXISTS idx_cylinders_kho ON public.cylinders (kho);

COMMENT ON COLUMN public.cylinders.kho IS 'Mã kho quản lý bình (VD: OCP1) — dùng trên /binh';

SELECT
    column_name,
    data_type,
    (SELECT COUNT(*)::int FROM public.cylinders WHERE kho IS NOT NULL AND trim(kho) <> '') AS so_binh_co_kho
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cylinders'
  AND column_name = 'kho';
