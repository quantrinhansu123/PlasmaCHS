-- ═══════════════════════════════════════════════════════════════════════════
-- SỬA LỖI trigger + gán kho = OCP1 (chạy TOÀN BỘ file này trên Supabase)
-- Lỗi: record "old" has no field "warehouse_id" … func_log_cylinder_activity()
-- Chỉ dùng cột kho (TEXT, VD: OCP1) — KHÔNG dùng warehouse_id UUID trên cylinders
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.cylinders ADD COLUMN IF NOT EXISTS kho TEXT;

-- Đồng bộ kho từ cột warehouse cũ (nếu kho còn trống)
UPDATE public.cylinders
SET kho = NULLIF(trim(warehouse), ''), updated_at = NOW()
WHERE (kho IS NULL OR trim(kho) = '')
  AND warehouse IS NOT NULL
  AND trim(warehouse) <> '';

-- 1) Tắt trigger cũ TRƯỚC (để UPDATE không còn gọi hàm lỗi)
DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON public.cylinders;

-- 2) Xóa hàm cũ (còn tham chiếu OLD.warehouse_id)
DROP FUNCTION IF EXISTS public.func_log_cylinder_activity() CASCADE;
DROP FUNCTION IF EXISTS public.log_cylinder_changes() CASCADE;

-- 3) Hàm log mới — CHỈ cột kho, không tra UUID warehouses
CREATE OR REPLACE FUNCTION public.func_log_cylinder_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_kho TEXT;
    new_kho TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cylinder_logs'
    ) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        new_kho := NULLIF(trim(NEW.kho), '');
        INSERT INTO public.cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description)
        VALUES (
            NEW.id,
            NEW.serial_number,
            NULL,
            'KHOI_TAO',
            'Khởi tạo vỏ bình mới trên hệ thống'
                || CASE WHEN new_kho IS NOT NULL THEN ' | Kho: ' || new_kho ELSE '' END
        );
    ELSIF TG_OP = 'UPDATE' THEN
        old_kho := NULLIF(trim(OLD.kho), '');
        new_kho := NULLIF(trim(NEW.kho), '');
        IF OLD.status IS DISTINCT FROM NEW.status
            OR old_kho IS DISTINCT FROM new_kho
            OR NEW.last_log_image IS NOT NULL
        THEN
            INSERT INTO public.cylinder_logs (cylinder_id, serial_number, warehouse_id, action, description, image_url)
            VALUES (
                NEW.id,
                NEW.serial_number,
                NULL,
                'CAP_NHAT_TRANG_THAI',
                'Cập nhật trạng thái từ ' || COALESCE(OLD.status, '') || ' sang ' || COALESCE(NEW.status, '')
                    || CASE WHEN old_kho IS DISTINCT FROM new_kho
                        THEN ' (Chuyển kho: ' || COALESCE(old_kho, '—') || ' → ' || COALESCE(new_kho, '—') || ')'
                        ELSE ''
                    END,
                NEW.last_log_image
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 4) Gán OCP1 (trigger đã tắt nên UPDATE an toàn)
UPDATE public.cylinders
SET kho = 'OCP1', updated_at = NOW()
WHERE status IS DISTINCT FROM 'đã trả ncc';

UPDATE public.cylinders
SET kho = NULL, updated_at = NOW()
WHERE status = 'đã trả ncc';

CREATE INDEX IF NOT EXISTS idx_cylinders_kho ON public.cylinders (kho);

-- 5) Bật lại trigger mới
CREATE TRIGGER trig_log_cylinder_changes
    AFTER INSERT OR UPDATE ON public.cylinders
    FOR EACH ROW
    EXECUTE FUNCTION public.func_log_cylinder_activity();

-- 6) Trigger nha_may: đổi warehouse_id → kho (nếu có hàm compute_cylinder_nha_may)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'compute_cylinder_nha_may'
    ) THEN
        RETURN;
    END IF;

    CREATE OR REPLACE FUNCTION public.sync_cylinder_nha_may()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
        NEW.nha_may := public.compute_cylinder_nha_may(
            COALESCE(NULLIF(trim(NEW.kho), ''), ''),
            NEW.customer_name,
            NEW.status
        );
        RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_cylinders_sync_nha_may ON public.cylinders;
    CREATE TRIGGER trg_cylinders_sync_nha_may
        BEFORE INSERT OR UPDATE OF kho, customer_name, status
        ON public.cylinders
        FOR EACH ROW
        EXECUTE FUNCTION public.sync_cylinder_nha_may();
END $$;

SELECT 'OK' AS status, COUNT(*) FILTER (WHERE kho = 'OCP1')::int AS binh_ocp1
FROM public.cylinders;

-- 7) RLS: app dùng anon key — cần policy mở, nếu không /binh trống
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'cylinders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.cylinders', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.cylinders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cylinders_select_all"
    ON public.cylinders FOR SELECT USING (true);
CREATE POLICY "cylinders_insert_all"
    ON public.cylinders FOR INSERT WITH CHECK (true);
CREATE POLICY "cylinders_update_all"
    ON public.cylinders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cylinders_delete_all"
    ON public.cylinders FOR DELETE USING (true);
