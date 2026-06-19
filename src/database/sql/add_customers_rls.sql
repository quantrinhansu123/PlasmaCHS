-- ============================================================================
-- RLS: customers
--
-- App đăng nhập custom (localStorage), không map auth.uid() → policy scope cũ chặn SELECT.
-- Chạy trên Supabase SQL Editor khi /khach-hang trống sau import.
-- ============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'customers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_all"
    ON public.customers
    FOR SELECT
    USING (true);

CREATE POLICY "customers_insert_all"
    ON public.customers
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "customers_update_all"
    ON public.customers
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "customers_delete_all"
    ON public.customers
    FOR DELETE
    USING (true);

SELECT
    (SELECT COUNT(*)::int FROM public.customers) AS row_count,
    (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers') AS policy_count;
