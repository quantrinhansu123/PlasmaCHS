-- Fix: invalid input syntax for type uuid: "buixuanuc" / "OCP1"
-- Chạy TOÀN BỘ file này trên Supabase SQL Editor (một lần).
--
-- Nếu thêm kho từ app báo RLS → chạy thêm: add_warehouses_rls.sql

-- 1) Đổi customers.warehouse_id: UUID → TEXT
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'code'
    ) THEN
        ALTER TABLE public.warehouses ADD COLUMN code VARCHAR(50);
    END IF;
END $$;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_warehouse_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS fk_customers_warehouse;

DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'warehouse_id';

    IF col_type IS NULL THEN
        ALTER TABLE public.customers ADD COLUMN warehouse_id TEXT;
        RETURN;
    END IF;

    IF col_type = 'uuid' THEN
        ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS warehouse_code TEXT;

        UPDATE public.customers c
        SET warehouse_code = COALESCE(
            NULLIF(trim(w.code), ''),
            'OCP1'
        )
        FROM public.warehouses w
        WHERE c.warehouse_id IS NOT NULL
          AND w.id = c.warehouse_id;

        UPDATE public.customers
        SET warehouse_code = 'OCP1'
        WHERE warehouse_code IS NULL OR trim(warehouse_code) = '';

        ALTER TABLE public.customers DROP COLUMN warehouse_id;
        ALTER TABLE public.customers RENAME COLUMN warehouse_code TO warehouse_id;
    ELSIF col_type <> 'text' AND col_type <> 'character varying' THEN
        ALTER TABLE public.customers
            ALTER COLUMN warehouse_id TYPE TEXT
            USING trim(warehouse_id::text);
    END IF;
END $$;

-- 2) Gán OCP1 cho tất cả KH
UPDATE public.customers
SET warehouse_id = 'OCP1'
WHERE warehouse_id IS NULL
   OR trim(warehouse_id) = ''
   OR warehouse_id IS DISTINCT FROM 'OCP1';

COMMENT ON COLUMN public.customers.warehouse_id IS 'Mã kho phụ trách (text: OCP1) — KHÔNG dùng UUID';

SELECT warehouse_id, COUNT(*) AS so_khach
FROM public.customers
GROUP BY warehouse_id
ORDER BY so_khach DESC;
