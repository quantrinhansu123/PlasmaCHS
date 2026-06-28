-- =============================================================================
-- Dọn kho trên bình đã trả NCC (kho + warehouse phải NULL)
--
-- Lỗi "relation public.cylinders does not exist":
--   → Bạn đang chạy trên SAI Supabase project HOẶC bảng chưa tạo.
--   → So sánh Supabase → Settings → API URL với VITE_SUPABASE_URL trong .env
--   → Nếu app /binh vẫn có dữ liệu: chắc chắn chọn đúng project rồi chạy lại.
--   → Nếu project mới / trống: chạy TRƯỚC file ensure_cylinders_table.sql
-- =============================================================================

-- (Tùy chọn) Kiểm tra bảng có tồn tại không:
-- SELECT to_regclass('public.cylinders') AS cylinders_table;

DO $$
BEGIN
    IF to_regclass('public.cylinders') IS NULL THEN
        RAISE EXCEPTION
            'Bảng public.cylinders chưa tồn tại trên database này. '
            'Chạy ensure_cylinders_table.sql trên đúng Supabase project (khớp VITE_SUPABASE_URL), sau đó chạy lại script này.';
    END IF;

    UPDATE public.cylinders
    SET
        kho = NULL,
        warehouse = NULL,
        updated_at = NOW()
    WHERE status = 'đã trả ncc'
      AND (kho IS NOT NULL OR warehouse IS NOT NULL);

    RAISE NOTICE 'Đã dọn kho cho bình đã trả NCC.';
END $$;
