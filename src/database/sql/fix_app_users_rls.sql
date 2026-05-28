-- ============================================================================
-- RLS: app_users
--
-- App đăng nhập qua app_users + bcrypt (Login.jsx), dùng Supabase anon key.
-- Policy chỉ cho role authenticated / auth.uid() sẽ chặn INSERT/UPDATE/DELETE.
--
-- Chạy file này trên Supabase SQL Editor khi gặp:
--   "new row violates row-level security policy for table app_users"
-- ============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'app_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_users', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_users_select_all"
    ON public.app_users
    FOR SELECT
    USING (true);

CREATE POLICY "app_users_insert_all"
    ON public.app_users
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "app_users_update_all"
    ON public.app_users
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "app_users_delete_all"
    ON public.app_users
    FOR DELETE
    USING (true);
