-- Gán trạng thái Thành công cho KH import (đang «Chưa thành công» → không hiện trên /khach-hang cũ)
-- Chạy trên Supabase SQL Editor

UPDATE public.customers
SET
    status = 'Thành công',
    success_at = COALESCE(success_at, NOW()),
    updated_at = NOW()
WHERE status IS DISTINCT FROM 'Thành công'
   OR status IS NULL
   OR trim(status) = '';

SELECT status, COUNT(*) AS so_khach
FROM public.customers
GROUP BY status
ORDER BY so_khach DESC;
