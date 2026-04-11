-- Migration: Add delivery confirmation fields to orders table
-- Date: 2026-04-11
-- Description: Thêm cột lưu ảnh phiếu xác nhận giao hàng (base64) và checklist hàng hóa đã giao

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_base64 TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_checklist JSONB;
