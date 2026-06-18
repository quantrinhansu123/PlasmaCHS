-- cylinders: tạo bảng (nếu thiếu) + warehouse_id/uuid → warehouse (text) = OCP1
-- Chạy một lần trên Supabase SQL Editor.
--
-- QUAN TRỌNG: So sánh Supabase → Settings → API URL với VITE_SUPABASE_URL trong .env
-- Nếu app /binh đã có dữ liệu mà script báo bảng không tồn tại → đang chạy SAI project!

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── A. Tạo bảng cylinders nếu chưa có (schema mới: cột warehouse TEXT) ──
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
    warehouse TEXT,
    supplier_id UUID,
    customer_assigned_at TIMESTAMPTZ,
    last_log_image TEXT,
    nha_may BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Bổ sung cột thiếu trên DB cũ
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse_id'
        ) THEN
            ALTER TABLE public.cylinders RENAME COLUMN warehouse_id TO warehouse;
        ELSE
            ALTER TABLE public.cylinders ADD COLUMN warehouse TEXT;
        END IF;
    END IF;
END $$;

-- ── B. Migrate DB cũ: warehouse_id (uuid) → warehouse (text) = OCP1 ──

-- B.0 Gỡ trigger + view phụ thuộc cột warehouse_id (PostgreSQL chặn ALTER TYPE nếu còn view)
DROP TRIGGER IF EXISTS trg_cylinders_sync_nha_may ON public.cylinders;
DROP TRIGGER IF EXISTS trg_update_customer_assigned_at ON public.cylinders;
DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON public.cylinders;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT DISTINCT n.nspname AS schema_name, c.relname AS view_name
        FROM pg_depend d
        JOIN pg_rewrite rw ON d.objid = rw.oid
        JOIN pg_class c ON rw.ev_class = c.oid AND c.relkind = 'v'
        JOIN pg_class t ON d.refobjid = t.oid AND t.relkind = 'r'
        JOIN pg_namespace n ON c.relnamespace = n.oid
        JOIN pg_namespace tn ON t.relnamespace = tn.oid
        WHERE tn.nspname = 'public'
          AND t.relname = 'cylinders'
          AND n.nspname = 'public'
    ) LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schema_name, r.view_name);
        RAISE NOTICE 'Dropped view %.%', r.schema_name, r.view_name;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cylinders'
    ) THEN
        RAISE NOTICE 'Bảng cylinders không tồn tại — đã tạo ở bước A.';
        RETURN;
    END IF;

    ALTER TABLE public.cylinders DROP CONSTRAINT IF EXISTS cylinders_warehouse_id_fkey;
END $$;

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
            ALTER COLUMN warehouse_id TYPE TEXT
            USING (
                CASE
                    WHEN status = 'đã trả ncc' THEN NULL::text
                    ELSE 'OCP1'
                END
            );
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cylinders'
          AND column_name = 'warehouse_id'
          AND udt_name IN ('text', 'varchar', 'character varying')
    ) THEN
        UPDATE public.cylinders
        SET warehouse_id = 'OCP1'
        WHERE status IS DISTINCT FROM 'đã trả ncc'
          AND (
            warehouse_id IS NULL
            OR trim(warehouse_id) = ''
            OR warehouse_id IS DISTINCT FROM 'OCP1'
          );
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse'
    ) THEN
        ALTER TABLE public.cylinders RENAME COLUMN warehouse_id TO warehouse;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cylinders'
          AND column_name = 'warehouse'
          AND udt_name = 'uuid'
    ) THEN
        ALTER TABLE public.cylinders
            ALTER COLUMN warehouse TYPE TEXT
            USING (
                CASE
                    WHEN status = 'đã trả ncc' THEN NULL::text
                    ELSE 'OCP1'
                END
            );
    END IF;
END $$;

UPDATE public.cylinders
SET warehouse = 'OCP1'
WHERE status IS DISTINCT FROM 'đã trả ncc'
  AND (
    warehouse IS NULL
    OR trim(warehouse) = ''
    OR warehouse IS DISTINCT FROM 'OCP1'
  );

-- ── C. Index & comment ──
DROP INDEX IF EXISTS public.idx_cylinders_warehouse_id;
CREATE INDEX IF NOT EXISTS idx_cylinders_warehouse ON public.cylinders (warehouse);
CREATE INDEX IF NOT EXISTS idx_cylinders_status ON public.cylinders (status);

COMMENT ON TABLE public.cylinders IS 'Danh sách vỏ bình /binh';
COMMENT ON COLUMN public.cylinders.warehouse IS 'Mã kho quản lý (VD: OCP1) — đồng bộ machines.warehouse';

ALTER TABLE public.cylinders ENABLE ROW LEVEL SECURITY;

-- ── D. Tạo lại view aging (dùng cột warehouse) ──
CREATE OR REPLACE VIEW public.view_cylinder_aging_stats AS
SELECT
    warehouse AS kho,
    COUNT(*) AS tong_so_binh_khach_giu,
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 30 AND CURRENT_DATE - customer_assigned_at::DATE <= 60 THEN 1 END) AS qua_han_30_60,
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 60 AND CURRENT_DATE - customer_assigned_at::DATE <= 90 THEN 1 END) AS qua_han_60_90,
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 90 THEN 1 END) AS qua_han_tren_90,
    COUNT(CASE WHEN CURRENT_DATE - customer_assigned_at::DATE > 30 THEN 1 END) AS tong_qua_han
FROM public.cylinders
WHERE status IN ('thuộc khách hàng', 'đang sử dụng')
  AND customer_assigned_at IS NOT NULL
GROUP BY warehouse;

CREATE OR REPLACE VIEW public.view_cylinder_aging_details AS
SELECT
    id,
    serial_number AS ma_binh,
    customer_name AS khach_hang,
    warehouse AS kho,
    customer_assigned_at::DATE AS ngay_giao,
    CURRENT_DATE - customer_assigned_at::DATE AS so_ngay_ton
FROM public.cylinders
WHERE status IN ('thuộc khách hàng', 'đang sử dụng')
  AND customer_assigned_at IS NOT NULL
  AND CURRENT_DATE - customer_assigned_at::DATE > 30
ORDER BY so_ngay_ton DESC;

-- ── E. Trigger nha_may (cột warehouse) — nếu đã có hàm compute_cylinder_nha_may ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'compute_cylinder_nha_may'
    ) THEN
        RAISE NOTICE 'Bỏ qua trigger nha_may: chưa có compute_cylinder_nha_may (chạy add_cylinder_nha_may.sql nếu cần).';
        RETURN;
    END IF;

    CREATE OR REPLACE FUNCTION public.sync_cylinder_nha_may()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
        NEW.nha_may := public.compute_cylinder_nha_may(
            NEW.warehouse::text,
            NEW.customer_name,
            NEW.status
        );
        RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_cylinders_sync_nha_may ON public.cylinders;
    CREATE TRIGGER trg_cylinders_sync_nha_may
        BEFORE INSERT OR UPDATE OF warehouse, customer_name, status
        ON public.cylinders
        FOR EACH ROW
        EXECUTE FUNCTION public.sync_cylinder_nha_may();

    UPDATE public.cylinders c
    SET nha_may = public.compute_cylinder_nha_may(c.warehouse::text, c.customer_name, c.status);
END $$;

CREATE OR REPLACE FUNCTION public.update_customer_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status IN ('thuộc khách hàng', 'đang sử dụng')
        AND (OLD.status NOT IN ('thuộc khách hàng', 'đang sử dụng') OR OLD.status IS NULL)) THEN
        NEW.customer_assigned_at = CURRENT_TIMESTAMP;
    ELSIF (NEW.status NOT IN ('thuộc khách hàng', 'đang sử dụng')
        AND OLD.status IN ('thuộc khách hàng', 'đang sử dụng')) THEN
        NEW.customer_assigned_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_assigned_at ON public.cylinders;
CREATE TRIGGER trg_update_customer_assigned_at
    BEFORE UPDATE ON public.cylinders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_customer_assigned_at();

-- ── F. Trigger log (chỉ khi có bảng cylinder_logs) ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cylinder_logs'
    ) THEN
        RAISE NOTICE 'Bỏ qua trigger: bảng cylinder_logs chưa có.';
        RETURN;
    END IF;

    EXECUTE $outer$
        CREATE OR REPLACE FUNCTION public.cylinder_json_kho_value(row_json JSONB)
        RETURNS TEXT LANGUAGE sql IMMUTABLE AS $inner$
            SELECT COALESCE(
                NULLIF(trim(row_json->>'kho'), ''),
                NULLIF(trim(row_json->>'warehouse'), ''),
                NULLIF(trim(row_json->>'warehouse_id'), '')
            );
        $inner$;
    $outer$;

    EXECUTE $outer$
        CREATE OR REPLACE FUNCTION public.func_log_cylinder_activity()
        RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
        DECLARE
            old_kho TEXT;
            new_kho TEXT;
            log_wh_id UUID;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                new_kho := public.cylinder_json_kho_value(to_jsonb(NEW));
                log_wh_id := (
                    SELECT w.id FROM public.warehouses w
                    WHERE new_kho IS NOT NULL AND trim(new_kho) <> ''
                      AND (lower(trim(w.code)) = lower(trim(new_kho))
                        OR lower(trim(w.name)) = lower(trim(new_kho))
                        OR w.id::text = trim(new_kho))
                    LIMIT 1
                );
                INSERT INTO public.cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description)
                VALUES (NEW.id, NEW.serial_number, log_wh_id, 'KHOI_TAO',
                    'Khởi tạo vỏ bình mới trên hệ thống'
                    || CASE WHEN new_kho IS NOT NULL AND trim(new_kho) <> '' THEN ' | Kho: ' || new_kho ELSE '' END);
            ELSIF TG_OP = 'UPDATE' THEN
                old_kho := public.cylinder_json_kho_value(to_jsonb(OLD));
                new_kho := public.cylinder_json_kho_value(to_jsonb(NEW));
                IF OLD.status IS DISTINCT FROM NEW.status
                    OR old_kho IS DISTINCT FROM new_kho
                    OR NEW.last_log_image IS NOT NULL THEN
                    log_wh_id := (
                        SELECT w.id FROM public.warehouses w
                        WHERE new_kho IS NOT NULL AND trim(new_kho) <> ''
                          AND (lower(trim(w.code)) = lower(trim(new_kho))
                            OR lower(trim(w.name)) = lower(trim(new_kho))
                            OR w.id::text = trim(new_kho))
                        LIMIT 1
                    );
                    INSERT INTO public.cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description, image_url)
                    VALUES (NEW.id, NEW.serial_number, log_wh_id, 'CAP_NHAT',
                        'Cập nhật: ' || COALESCE(NEW.status, '')
                        || CASE WHEN old_kho IS DISTINCT FROM new_kho
                            THEN ' (Chuyển kho: ' || COALESCE(old_kho, '') || ' → ' || COALESCE(new_kho, '') || ')'
                            ELSE '' END,
                        NEW.last_log_image);
                END IF;
            END IF;
            RETURN NEW;
        END;
        $fn$;
    $outer$;

    DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON public.cylinders;
    CREATE TRIGGER trig_log_cylinder_changes
        AFTER INSERT OR UPDATE ON public.cylinders
        FOR EACH ROW EXECUTE FUNCTION public.func_log_cylinder_activity();
END $$;

-- ── Kiểm tra ──
SELECT
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cylinders'
    ) AS has_cylinders_table,
    (
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cylinders' AND column_name = 'warehouse'
        LIMIT 1
    ) AS warehouse_column,
    (SELECT COUNT(*)::int FROM public.cylinders) AS total_binh,
    (SELECT COUNT(*)::int FROM public.cylinders WHERE warehouse = 'OCP1') AS so_binh_ocp1;

-- Bước tiếp theo: chạy add_cylinder_kho_column.sql để thêm/đồng bộ cột kho (mã OCP1…)
