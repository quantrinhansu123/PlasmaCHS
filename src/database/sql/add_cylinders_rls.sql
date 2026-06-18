-- ============================================================================
-- RLS: cylinders
--
-- App đăng nhập qua app_users + bcrypt (Login.jsx), request dùng anon key.
-- Nếu bật RLS mà không có policy → SELECT trả về 0 dòng (trang /binh trống).
--
-- Chạy file này trên Supabase SQL Editor khi danh sách bình trống dù có dữ liệu.
-- ============================================================================

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
    ON public.cylinders
    FOR SELECT
    USING (true);

CREATE POLICY "cylinders_insert_all"
    ON public.cylinders
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "cylinders_update_all"
    ON public.cylinders
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "cylinders_delete_all"
    ON public.cylinders
    FOR DELETE
    USING (true);

SELECT
    (SELECT COUNT(*)::int FROM public.cylinders) AS row_count,
    (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cylinders') AS policy_count;
