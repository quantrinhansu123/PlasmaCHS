-- ============================================================================
-- RLS: warehouses
--
-- App dùng anon key. Nếu bật RLS không có policy INSERT → lỗi:
--   "new row violates row-level security policy for table warehouses"
-- Chạy trên Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'warehouses'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.warehouses', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select_all"
    ON public.warehouses
    FOR SELECT
    USING (true);

CREATE POLICY "warehouses_insert_all"
    ON public.warehouses
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "warehouses_update_all"
    ON public.warehouses
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "warehouses_delete_all"
    ON public.warehouses
    FOR DELETE
    USING (true);

SELECT
    (SELECT COUNT(*)::int FROM public.warehouses) AS row_count,
    (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses') AS policy_count;
