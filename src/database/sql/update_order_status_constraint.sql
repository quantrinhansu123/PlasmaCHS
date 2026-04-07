-- Drop the existing constraint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "check_order_status";

-- Add the new constraint with all required statuses including DNXM flow
ALTER TABLE "orders" ADD CONSTRAINT "check_order_status" CHECK (
  status IN (
    'CHO_DUYET', 
    'CHO_CTY_DUYET', 
    'TRUONG_KD_XU_LY',
    'KD_XU_LY',
    'DIEU_CHINH', 
    'KHO_XU_LY', 
    'TU_CHOI',
    'DA_DUYET', 
    'CHO_GIAO_HANG', 
    'DANG_GIAO_HANG', 
    'CHO_DOI_SOAT', 
    'DOI_SOAT_THAT_BAI', 
    'HOAN_THANH', 
    'TRA_HANG', 
    'HUY_DON'
  )
);
