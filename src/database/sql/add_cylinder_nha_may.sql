-- Cột «Nhà máy» (nha_may) trên bảng cylinders — trang /binh
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor (project đang dùng cho app).
--
-- Nếu lỗi "relation cylinders does not exist": file này sẽ tạo bảng public.cylinders (rỗng).
-- Nếu app /binh đã có dữ liệu mà vẫn lỗi → kiểm tra đúng Supabase project (Settings → API URL).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Bước 1: Đảm bảo bảng cylinders tồn tại (không DROP — an toàn production)
-- =============================================================================
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

-- Ràng buộc UNIQUE serial (nếu chưa có)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cylinders_serial_number_key'
          AND conrelid = 'public.cylinders'::regclass
    ) THEN
        ALTER TABLE public.cylinders
            ADD CONSTRAINT cylinders_serial_number_key UNIQUE (serial_number);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Bổ sung cột cho DB cũ (bảng đã tồn tại nhưng thiếu cột)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE public.cylinders ADD COLUMN warehouse_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE public.cylinders ADD COLUMN supplier_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'nha_may'
    ) THEN
        ALTER TABLE public.cylinders ADD COLUMN nha_may BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

COMMENT ON COLUMN public.cylinders.nha_may IS
    'Nhà máy: bình ở kho NM, không gán khách, trạng thái sẵn sàng/bình rỗng/chờ nạp. Đồng bộ trigger sync_cylinder_nha_may.';

CREATE INDEX IF NOT EXISTS idx_cylinders_nha_may ON public.cylinders (nha_may) WHERE nha_may = TRUE;

-- =============================================================================
-- Bước 2: Hàm tính «Nhà máy» (warehouse_id có thể là UUID text hoặc mã kho)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_factory_warehouse(p_warehouse_ref TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.warehouses w
        WHERE p_warehouse_ref IS NOT NULL
          AND trim(p_warehouse_ref) <> ''
          AND (
              w.id::text = trim(p_warehouse_ref)
              OR trim(coalesce(w.code, '')) = trim(p_warehouse_ref)
              OR trim(coalesce(w.name, '')) = trim(p_warehouse_ref)
          )
          AND (
              lower(trim(coalesce(w.code, ''))) = 'nm'
              OR lower(trim(coalesce(w.name, ''))) LIKE '%nhà máy%'
              OR lower(trim(coalesce(w.name, ''))) LIKE '%nha may%'
              OR lower(trim(coalesce(w.name, ''))) LIKE '%nhamay%'
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.compute_cylinder_nha_may(
    p_warehouse_ref TEXT,
    p_customer_name TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT
        coalesce(trim(p_customer_name), '') = ''
        AND lower(trim(coalesce(p_status, ''))) IN (
            'sẵn sàng',
            'bình rỗng',
            'chờ nạp'
        )
        AND p_warehouse_ref IS NOT NULL
        AND trim(p_warehouse_ref) <> ''
        AND public.is_factory_warehouse(p_warehouse_ref);
$$;

CREATE OR REPLACE FUNCTION public.sync_cylinder_nha_may()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.nha_may := public.compute_cylinder_nha_may(
        NEW.warehouse_id::text,
        NEW.customer_name,
        NEW.status
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cylinders_sync_nha_may ON public.cylinders;

CREATE TRIGGER trg_cylinders_sync_nha_may
    BEFORE INSERT OR UPDATE OF warehouse_id, customer_name, status
    ON public.cylinders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_cylinder_nha_may();

UPDATE public.cylinders c
SET nha_may = public.compute_cylinder_nha_may(
    c.warehouse_id::text,
    c.customer_name,
    c.status
);

-- Trigger kho (chỉ khi có bảng warehouses + cột code)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'warehouses'
    ) THEN
        CREATE OR REPLACE FUNCTION public.sync_cylinders_nha_may_after_warehouse_change()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            UPDATE public.cylinders c
            SET nha_may = public.compute_cylinder_nha_may(
                c.warehouse_id::text,
                c.customer_name,
                c.status
            )
            WHERE c.warehouse_id::text = NEW.id::text
               OR trim(coalesce(c.warehouse_id::text, '')) = trim(coalesce(NEW.code, ''))
               OR trim(coalesce(c.warehouse_id::text, '')) = trim(coalesce(NEW.name, ''));
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS trg_warehouses_sync_cylinders_nha_may ON public.warehouses;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'code'
        ) THEN
            CREATE TRIGGER trg_warehouses_sync_cylinders_nha_may
                AFTER UPDATE OF code, name
                ON public.warehouses
                FOR EACH ROW
                EXECUTE FUNCTION public.sync_cylinders_nha_may_after_warehouse_change();
        ELSE
            CREATE TRIGGER trg_warehouses_sync_cylinders_nha_may
                AFTER UPDATE OF name
                ON public.warehouses
                FOR EACH ROW
                EXECUTE FUNCTION public.sync_cylinders_nha_may_after_warehouse_change();
        END IF;
    END IF;
END $$;

-- Kiểm tra nhanh sau khi chạy:
-- SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE nha_may) AS at_nha_may FROM public.cylinders;
