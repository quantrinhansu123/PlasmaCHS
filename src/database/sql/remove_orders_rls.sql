-- Tắt RLS trên bảng orders và xóa toàn bộ policy liên quan.
-- Chạy trên Supabase SQL Editor nếu đang gặp: new row violates row-level security policy for table "orders"

DROP POLICY IF EXISTS "orders_select_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_update_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin_only" ON public.orders;

ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
