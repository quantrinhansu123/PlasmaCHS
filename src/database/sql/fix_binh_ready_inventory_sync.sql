-- =============================================================================
-- Sửa tồn bình «sẵn sàng» lệch sau giao hàng / xuất kho
--
-- 1. Xóa kho trên bình không còn ở kho (đã giao, đang vận chuyển…)
-- 2. Bình «sẵn sàng» nhưng đã gán khách → chuyển «thuộc khách hàng»
-- 3. (Tùy chọn) Đồng bộ bảng inventory BINH_* theo đếm thực tế
--
-- Chạy trên đúng Supabase project (khớp VITE_SUPABASE_URL).
-- Hoặc dùng nút «Đồng bộ tồn sẵn sàng» trên trang /binh trong app.
-- =============================================================================

DO $$
DECLARE
    cleared_kho INTEGER;
    fixed_ready INTEGER;
BEGIN
    IF to_regclass('public.cylinders') IS NULL THEN
        RAISE EXCEPTION 'Bảng public.cylinders chưa tồn tại. Chạy ensure_cylinders_table.sql trước.';
    END IF;

    UPDATE public.cylinders
    SET
        kho = NULL,
        warehouse = NULL,
        updated_at = NOW()
    WHERE status IN (
        'thuộc khách hàng',
        'đang sử dụng',
        'đã sử dụng',
        'đang vận chuyển',
        'đã trả ncc'
    )
      AND (kho IS NOT NULL OR warehouse IS NOT NULL);

    GET DIAGNOSTICS cleared_kho = ROW_COUNT;

    UPDATE public.cylinders
    SET
        status = 'thuộc khách hàng',
        kho = NULL,
        warehouse = NULL,
        updated_at = NOW()
    WHERE status = 'sẵn sàng'
      AND customer_name IS NOT NULL
      AND TRIM(customer_name) <> '';

    GET DIAGNOSTICS fixed_ready = ROW_COUNT;

    RAISE NOTICE 'Đã xóa kho trên % bình không còn tại kho.', cleared_kho;
    RAISE NOTICE 'Đã chuyển % bình sẵn sàng (đã gán khách) → thuộc khách hàng.', fixed_ready;
END $$;

-- Đồng bộ inventory BINH_4L / BINH_8L / BINH theo bình sẵn sàng tại từng kho
-- (chỉ khi bảng inventory + warehouses đã có)
DO $$
DECLARE
    wh RECORD;
    ready_4l INTEGER;
    ready_8l INTEGER;
    ready_binh INTEGER;
    wh_key TEXT;
BEGIN
    IF to_regclass('public.inventory') IS NULL OR to_regclass('public.warehouses') IS NULL THEN
        RAISE NOTICE 'Bỏ qua sync inventory — chưa có bảng inventory hoặc warehouses.';
        RETURN;
    END IF;

    FOR wh IN
        SELECT id, code, name FROM public.warehouses ORDER BY name
    LOOP
        wh_key := COALESCE(NULLIF(TRIM(wh.code), ''), NULLIF(TRIM(wh.name), ''), wh.id::TEXT);

        SELECT COUNT(*) INTO ready_4l
        FROM public.cylinders c
        WHERE c.status = 'sẵn sàng'
          AND c.kho IN (wh.code, wh.name, wh.id::TEXT)
          AND (
              LOWER(COALESCE(c.volume, '')) ~ 'binh\s*4\s*l'
              OR (LOWER(COALESCE(c.volume, '')) ~ '\m4\s*l' AND LOWER(COALESCE(c.volume, '')) !~ '40l')
          );

        SELECT COUNT(*) INTO ready_8l
        FROM public.cylinders c
        WHERE c.status = 'sẵn sàng'
          AND c.kho IN (wh.code, wh.name, wh.id::TEXT)
          AND (LOWER(COALESCE(c.volume, '')) LIKE '%8l%' OR LOWER(COALESCE(c.volume, '')) LIKE '%8 l%');

        SELECT COUNT(*) INTO ready_binh
        FROM public.cylinders c
        WHERE c.status = 'sẵn sàng'
          AND c.kho IN (wh.code, wh.name, wh.id::TEXT);

        UPDATE public.inventory
        SET quantity = ready_4l, updated_at = NOW()
        WHERE warehouse_id IN (wh.code, wh.name, wh.id::TEXT)
          AND item_type IN ('BINH_4L', 'BINH')
          AND (
              LOWER(item_name) LIKE '%4l%'
              OR LOWER(item_name) LIKE '%bình 4%'
              OR item_type = 'BINH_4L'
          );

        UPDATE public.inventory
        SET quantity = ready_8l, updated_at = NOW()
        WHERE warehouse_id IN (wh.code, wh.name, wh.id::TEXT)
          AND item_type IN ('BINH_8L', 'BINH')
          AND (
              LOWER(item_name) LIKE '%8l%'
              OR LOWER(item_name) LIKE '%bình 8%'
              OR item_type = 'BINH_8L'
          );

        UPDATE public.inventory
        SET quantity = ready_binh, updated_at = NOW()
        WHERE warehouse_id IN (wh.code, wh.name, wh.id::TEXT)
          AND item_type = 'BINH'
          AND LOWER(COALESCE(item_name, '')) NOT LIKE '%4l%'
          AND LOWER(COALESCE(item_name, '')) NOT LIKE '%8l%';

        RAISE NOTICE 'Kho %: sẵn sàng 4L=%, 8L=%, tổng BINH=%', wh.name, ready_4l, ready_8l, ready_binh;
    END LOOP;

    RAISE NOTICE 'Hoàn tất đồng bộ inventory bình.';
END $$;
