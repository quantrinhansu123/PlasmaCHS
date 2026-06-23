-- ============================================================================
-- Tạo bảng goods_issues + goods_issue_items (phiếu xuất kho / trả NCC)
-- Chạy trên Supabase SQL Editor khi lỗi:
--   Could not find the table 'public.goods_issues' in the schema cache
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.goods_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_code VARCHAR(100) NOT NULL UNIQUE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issue_type VARCHAR(50) NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    notes TEXT,
    total_items INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_DUYET',
    deliverer_name VARCHAR(255),
    deliverer_address TEXT,
    received_by VARCHAR(255),
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goods_issue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.goods_issues(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_id UUID,
    item_code VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goods_issues ADD COLUMN IF NOT EXISTS deliverer_name VARCHAR(255);
ALTER TABLE public.goods_issues ADD COLUMN IF NOT EXISTS deliverer_address TEXT;
ALTER TABLE public.goods_issues ADD COLUMN IF NOT EXISTS received_by VARCHAR(255);
ALTER TABLE public.goods_issues ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_issue_status'
    ) THEN
        ALTER TABLE public.goods_issues ADD CONSTRAINT check_issue_status CHECK (
            status IN ('ALL', 'CHO_DUYET', 'DA_XUAT', 'HOAN_THANH', 'HUY')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_issue_type'
    ) THEN
        ALTER TABLE public.goods_issues ADD CONSTRAINT check_issue_type CHECK (
            issue_type IN ('TRA_NCC', 'HUY_XUAT', 'KHAC', 'TRA_VO', 'TRA_BINH_LOI', 'TRA_MAY')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_issue_item_type'
    ) THEN
        ALTER TABLE public.goods_issue_items ADD CONSTRAINT check_issue_item_type CHECK (
            item_type IN ('MAY', 'BINH', 'VAT_TU', 'BINH_4L', 'BINH_8L', 'MAY_ROSY', 'MAY_MED')
        );
    END IF;
END $$;

COMMENT ON TABLE public.goods_issues IS 'Phiếu xuất kho (trả vỏ, trả NCC, xuất huỷ...)';
COMMENT ON TABLE public.goods_issue_items IS 'Chi tiết mã tài sản trong phiếu xuất';

-- RLS (app dùng đăng nhập custom — policy mở cho authenticated/anon qua PostgREST)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'goods_issues'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.goods_issues', pol.policyname);
    END LOOP;
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'goods_issue_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.goods_issue_items', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.goods_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goods_issues_select_all" ON public.goods_issues FOR SELECT USING (true);
CREATE POLICY "goods_issues_insert_all" ON public.goods_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "goods_issues_update_all" ON public.goods_issues FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "goods_issues_delete_all" ON public.goods_issues FOR DELETE USING (true);

CREATE POLICY "goods_issue_items_select_all" ON public.goods_issue_items FOR SELECT USING (true);
CREATE POLICY "goods_issue_items_insert_all" ON public.goods_issue_items FOR INSERT WITH CHECK (true);
CREATE POLICY "goods_issue_items_update_all" ON public.goods_issue_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "goods_issue_items_delete_all" ON public.goods_issue_items FOR DELETE USING (true);

SELECT
    (SELECT COUNT(*)::int FROM public.goods_issues) AS goods_issues_rows,
    (SELECT COUNT(*)::int FROM public.goods_issue_items) AS goods_issue_items_rows,
    (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goods_issues') AS goods_issues_policies;
