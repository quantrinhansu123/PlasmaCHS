-- Gắn bình "đã trả ncc" với NCC cụ thể (giữ tên hiển thị sau khi warehouse_id = NULL).
-- Chạy trên Supabase SQL Editor trước khi dùng tính năng mới.

ALTER TABLE cylinders
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

COMMENT ON COLUMN cylinders.supplier_id IS 'NCC nhận lại vỏ khi status = đã trả ncc; NULL khi bình ở kho/khách';

CREATE INDEX IF NOT EXISTS idx_cylinders_supplier_id ON cylinders (supplier_id) WHERE supplier_id IS NOT NULL;
