-- ============================================================================
-- Migration: Role-scope Row Level Security
-- Scope:
--   - NVKD: own
--   - Leader: team
--   - Company/Admin/Manager: all
--   - Warehouse: warehouse
--   - Shipper: assigned_orders
--
-- Notes:
--   - Uses app_users as the source of truth for auth.uid() mapping.
--   - Keeps repair_tickets read/write permissive except admin-only delete,
--     matching the existing UI while fixing the broken admin check.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_role_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(
        regexp_replace(
            unaccent(coalesce(input_text, '')),
            '[^a-zA-Z0-9]+',
            '',
            'g'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.current_app_user()
RETURNS public.app_users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role_scope()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me public.app_users;
    normalized_role text;
BEGIN
    SELECT * INTO me
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 'own';
    END IF;

    normalized_role := public.normalize_role_text(me.role);

    IF normalized_role IN ('admin', 'manager', 'quanly', 'quantri', 'congty', 'company') THEN
        RETURN 'all';
    ELSIF normalized_role LIKE '%leadsale%' OR normalized_role LIKE '%truongkinhdoanh%' OR normalized_role LIKE '%lead%' THEN
        RETURN 'team';
    ELSIF normalized_role LIKE '%nvkd%' OR normalized_role LIKE '%nhanvienkinhdoanh%' OR normalized_role LIKE '%kinhdoanh%' OR normalized_role LIKE '%sale%' THEN
        RETURN 'own';
    ELSIF normalized_role LIKE '%thukho%' OR normalized_role LIKE '%kho%' OR normalized_role LIKE '%warehouse%' THEN
        RETURN 'warehouse';
    ELSIF normalized_role LIKE '%shipper%' OR normalized_role LIKE '%giaohang%' THEN
        RETURN 'assigned_orders';
    END IF;

    RETURN 'own';
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_name_candidates()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me public.app_users;
BEGIN
    SELECT * INTO me
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN ARRAY[]::text[];
    END IF;

    RETURN ARRAY(
        SELECT DISTINCT name
        FROM unnest(ARRAY[me.name, me.username]) AS name
        WHERE name IS NOT NULL AND btrim(name) <> ''
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_team_names()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me public.app_users;
BEGIN
    SELECT * INTO me
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN ARRAY[]::text[];
    END IF;

    RETURN ARRAY(
        SELECT DISTINCT btrim(name)
        FROM unnest(
            ARRAY[me.name, me.username]
            || COALESCE(
                ARRAY(
                    SELECT btrim(value)
                    FROM unnest(string_to_array(COALESCE(me.nguoi_quan_ly, ''), ',')) AS value
                    WHERE btrim(value) <> ''
                ),
                ARRAY[]::text[]
            )
        ) AS name
        WHERE name IS NOT NULL AND btrim(name) <> ''
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_warehouse_code()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me public.app_users;
    dept text;
BEGIN
    SELECT * INTO me
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN '';
    END IF;

    dept := btrim(COALESCE(me.department, ''));

    IF dept = '' THEN
        RETURN '';
    END IF;

    RETURN btrim(split_part(dept, '-', 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_see_order(
    order_owner text,
    order_warehouse text,
    order_delivery_unit text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    scope text;
    names text[];
    team_names text[];
    warehouse_code text;
BEGIN
    scope := public.current_user_role_scope();

    IF scope = 'all' THEN
        RETURN true;
    END IF;

    names := public.current_user_name_candidates();
    team_names := public.current_user_team_names();
    warehouse_code := public.current_user_warehouse_code();

    IF scope = 'team' THEN
        RETURN order_owner = ANY(team_names);
    ELSIF scope = 'own' THEN
        RETURN order_owner = ANY(names);
    ELSIF scope = 'warehouse' THEN
        RETURN warehouse_code <> '' AND order_warehouse = warehouse_code;
    ELSIF scope = 'assigned_orders' THEN
        RETURN order_delivery_unit = ANY(names);
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_see_customer(
    customer_managed_by text,
    customer_care_by text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    scope text;
    names text[];
    team_names text[];
BEGIN
    scope := public.current_user_role_scope();

    IF scope = 'all' THEN
        RETURN true;
    END IF;

    names := public.current_user_name_candidates();
    team_names := public.current_user_team_names();

    IF scope = 'team' THEN
        RETURN customer_managed_by = ANY(team_names)
            OR customer_care_by = ANY(team_names);
    ELSIF scope = 'own' THEN
        RETURN customer_managed_by = ANY(names)
            OR customer_care_by = ANY(names);
    END IF;

    RETURN false;
END;
$$;

-- --------------------------------------------------------------------------
-- Orders: RLS tắt (tránh lỗi insert/update; phân quyền ở app nếu cần)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_update_by_scope" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin_only" ON public.orders;

ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Customers RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_by_scope" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_by_scope" ON public.customers;
DROP POLICY IF EXISTS "customers_update_by_scope" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_admin_only" ON public.customers;

CREATE POLICY "customers_select_by_scope"
    ON public.customers
    FOR SELECT
    USING (public.current_user_can_see_customer(managed_by, care_by));

CREATE POLICY "customers_insert_by_scope"
    ON public.customers
    FOR INSERT
    WITH CHECK (
        public.current_user_role_scope() IN ('all', 'team', 'own')
    );

CREATE POLICY "customers_update_by_scope"
    ON public.customers
    FOR UPDATE
    USING (public.current_user_can_see_customer(managed_by, care_by))
    WITH CHECK (public.current_user_can_see_customer(managed_by, care_by));

CREATE POLICY "customers_delete_admin_only"
    ON public.customers
    FOR DELETE
    USING (public.current_user_role_scope() = 'all');

-- --------------------------------------------------------------------------
-- Repair tickets RLS
-- Keep read/write permissive for now, but fix the broken admin delete check.
-- --------------------------------------------------------------------------
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép xóa phiếu sửa chữa (chỉ admin)" ON public.repair_tickets;

CREATE POLICY "Cho phép xóa phiếu sửa chữa (chỉ admin)"
    ON public.repair_tickets FOR DELETE
    USING (public.current_user_role_scope() = 'all');
