-- Thêm cột image_url thiếu trên cylinder_logs (trigger func_log_cylinder_activity ghi log khi đổi trạng thái bình)
ALTER TABLE public.cylinder_logs
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.cylinders
ADD COLUMN IF NOT EXISTS last_log_image TEXT;
