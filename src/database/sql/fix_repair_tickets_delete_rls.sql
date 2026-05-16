-- Cho phép xóa phiếu sửa chữa qua anon key (app không dùng Supabase Auth session).
-- Trước đây DELETE chỉ cho scope 'all' (auth.uid + admin/manager), nên xóa từ UI luôn thất bại.

DROP POLICY IF EXISTS "Cho phép xóa phiếu sửa chữa (chỉ admin)" ON public.repair_tickets;

CREATE POLICY "Cho phép xóa phiếu sửa chữa"
    ON public.repair_tickets
    FOR DELETE
    USING (true);

COMMENT ON POLICY "Cho phép xóa phiếu sửa chữa" ON public.repair_tickets IS
    'Đồng bộ với SELECT/INSERT/UPDATE: client dùng anon key, không có auth.uid().';
