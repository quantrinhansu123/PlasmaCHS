-- ============================================================================
-- RLS: machines
--
-- App dùng anon key. Nếu bật RLS không có policy → SELECT/INSERT trả lỗi hoặc 0 dòng.
-- Chạy trên Supabase SQL Editor khi /may trống hoặc không import được Excel.
-- ============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'machines'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.machines', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_select_all"
    ON public.machines
    FOR SELECT
    USING (true);

CREATE POLICY "machines_insert_all"
    ON public.machines
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "machines_update_all"
    ON public.machines
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "machines_delete_all"
    ON public.machines
    FOR DELETE
    USING (true);

SELECT
    (SELECT COUNT(*)::int FROM public.machines) AS row_count,
    (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machines') AS policy_count;
