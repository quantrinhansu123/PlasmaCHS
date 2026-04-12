-- Gom lịch sử chăm sóc theo SĐT (cùng một người có thể có nhiều dòng customers theo thời gian).
-- Chạy một lần trên Supabase (SQL editor) nếu muốn tránh fallback quét toàn bộ customers.

CREATE OR REPLACE FUNCTION public.normalize_vn_phone_digits(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input IS NULL OR length(trim(input)) = 0 THEN ''
    ELSE (
      WITH d AS (
        SELECT regexp_replace(trim(input), '\D', '', 'g') AS x
      )
      SELECT CASE
        WHEN length(d.x) >= 11 AND left(d.x, 2) = '84' THEN '0' || substring(d.x from 3)
        WHEN length(d.x) = 10 AND left(d.x, 1) = '0' THEN d.x
        WHEN length(d.x) = 9 THEN '0' || d.x
        ELSE d.x
      END
      FROM d
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.customer_ids_by_same_phone(p_customer_id uuid)
RETURNS TABLE(customer_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id
  FROM customers c
  CROSS JOIN LATERAL (
    SELECT NULLIF(public.normalize_vn_phone_digits(phone), '') AS pn
    FROM customers WHERE id = p_customer_id
  ) me
  WHERE (me.pn IS NULL AND c.id = p_customer_id)
     OR (me.pn IS NOT NULL AND public.normalize_vn_phone_digits(c.phone) = me.pn);
$$;

GRANT EXECUTE ON FUNCTION public.normalize_vn_phone_digits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_ids_by_same_phone(uuid) TO anon, authenticated;
