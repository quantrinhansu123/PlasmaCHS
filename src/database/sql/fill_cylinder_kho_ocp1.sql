-- Gán kho = OCP1 — CHỈ chạy SAU fix_cylinder_log_trigger_kho.sql
-- (Hoặc chạy luôn fix_cylinder_log_trigger_kho.sql — file đó đã gồm bước gán OCP1)

DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON public.cylinders;

ALTER TABLE public.cylinders ADD COLUMN IF NOT EXISTS kho TEXT;

UPDATE public.cylinders
SET kho = 'OCP1', updated_at = NOW()
WHERE status IS DISTINCT FROM 'đã trả ncc';

UPDATE public.cylinders
SET kho = NULL, updated_at = NOW()
WHERE status = 'đã trả ncc';

CREATE INDEX IF NOT EXISTS idx_cylinders_kho ON public.cylinders (kho);

-- Bật lại trigger (phải đã chạy fix_cylinder_log_trigger_kho.sql trước đó)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'func_log_cylinder_activity'
    ) THEN
        DROP TRIGGER IF EXISTS trig_log_cylinder_changes ON public.cylinders;
        CREATE TRIGGER trig_log_cylinder_changes
            AFTER INSERT OR UPDATE ON public.cylinders
            FOR EACH ROW
            EXECUTE FUNCTION public.func_log_cylinder_activity();
    ELSE
        RAISE EXCEPTION 'Chạy fix_cylinder_log_trigger_kho.sql trước!';
    END IF;
END $$;

SELECT kho, COUNT(*)::int AS so_luong FROM public.cylinders GROUP BY kho ORDER BY so_luong DESC;
