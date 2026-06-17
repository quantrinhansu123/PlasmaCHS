-- Chuyển cylinders.warehouse_id từ UUID → tên kho (warehouses.name)
-- Chạy một lần trên Supabase SQL Editor sau khi deploy app mới.

UPDATE public.cylinders AS c
SET warehouse_id = w.name
FROM public.warehouses AS w
WHERE c.warehouse_id IS NOT NULL
  AND trim(c.warehouse_id) <> ''
  AND c.warehouse_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND w.id::text = trim(c.warehouse_id);

-- Nếu cột đang là uuid, đổi sang text để lưu tên
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cylinders'
          AND column_name = 'warehouse_id'
          AND udt_name = 'uuid'
    ) THEN
        ALTER TABLE public.cylinders
            ALTER COLUMN warehouse_id TYPE TEXT USING warehouse_id::text;
    END IF;
END $$;
