-- ============================================================================
-- RLS: cylinder_recoveries + cylinder_recovery_items
--
-- App đăng nhập qua bảng app_users + bcrypt (Login.jsx), KHÔNG gọi
-- supabase.auth.signIn — request từ trình duyệt thường chạy với role anon.
-- Policy chỉ ghi TO authenticated sẽ KHÔNG áp dụng → mọi INSERT bị chặn.
--
-- Giải pháp: policy KHÔNG khai báo TO (áp dụng mọi role: anon + authenticated).
-- Phân quyền người dùng vẫn do ProtectedRoute + app_roles trên frontend.
--
-- Chạy lại: DROP POLICY trước, rồi DROP FUNCTION helper cũ (nếu còn).
-- ============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'cylinder_recoveries'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.cylinder_recoveries', pol.policyname);
    END LOOP;
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'cylinder_recovery_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.cylinder_recovery_items', pol.policyname);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.current_user_can_insert_cylinder_recovery(uuid, text);
DROP FUNCTION IF EXISTS public.current_user_can_see_cylinder_recovery(uuid, text, text);

-- --------------------------------------------------------------------------
-- cylinder_recoveries (mọi role — gồm anon khi chỉ dùng anon key)
-- --------------------------------------------------------------------------
ALTER TABLE public.cylinder_recoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cylinder_recoveries_select_all"
    ON public.cylinder_recoveries
    FOR SELECT
    USING (true);

CREATE POLICY "cylinder_recoveries_insert_all"
    ON public.cylinder_recoveries
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "cylinder_recoveries_update_all"
    ON public.cylinder_recoveries
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "cylinder_recoveries_delete_all"
    ON public.cylinder_recoveries
    FOR DELETE
    USING (true);

-- --------------------------------------------------------------------------
-- cylinder_recovery_items
-- --------------------------------------------------------------------------
ALTER TABLE public.cylinder_recovery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cylinder_recovery_items_select_all"
    ON public.cylinder_recovery_items
    FOR SELECT
    USING (true);

CREATE POLICY "cylinder_recovery_items_insert_all"
    ON public.cylinder_recovery_items
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "cylinder_recovery_items_update_all"
    ON public.cylinder_recovery_items
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "cylinder_recovery_items_delete_all"
    ON public.cylinder_recovery_items
    FOR DELETE
    USING (true);
