-- SQL Schema for Customer Transactions
-- Bảng lưu trữ lịch sử Thu/Chi liên quan đến Khách hàng

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS customer_transactions CASCADE;

CREATE TABLE customer_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code VARCHAR(50) UNIQUE NOT NULL, -- Mã giao dịch (VD: PT00001 - Phiếu Thu, PC00001 - Phiếu Chi hoàn tiền)
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Liên kết đến Khách hàng (có thể null nếu khách hàng bị xoá nhưng muốn giữ lịch sử)
    customer_name VARCHAR(255) NOT NULL, -- Lưu cứng tên để truy vấn nhanh và giữ lịch sử
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Số tiền giao dịch
    transaction_type VARCHAR(20) NOT NULL, -- 'THU' (Khách trả nợ/Mua hàng) hoặc 'CHI' (CTY hoàn tiền)
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Ngày thực hiện giao dịch
    payment_method VARCHAR(50) NOT NULL, -- CHUYEN_KHOAN, TIEN_MAT, KHAC
    note TEXT, -- Ghi chú (VD: Thanh toán tiền hàng lô T03)
    bill_image_url TEXT, -- URL ảnh bill/hóa đơn (lưu trên Supabase Storage)
    
    created_by VARCHAR(255), -- User thực hiện (Kế toán/Sale)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraints
ALTER TABLE customer_transactions ADD CONSTRAINT check_customer_tx_type CHECK (
    transaction_type IN ('THU', 'CHI')
);

ALTER TABLE customer_transactions ADD CONSTRAINT check_customer_payment_method CHECK (
    payment_method IN ('CHUYEN_KHOAN', 'TIEN_MAT', 'KHAC')
);

-- Comments
COMMENT ON TABLE customer_transactions IS 'Lịch sử giao dịch Thu/Chi với khách hàng';
COMMENT ON COLUMN customer_transactions.transaction_type IS 'THU = Thu tiền khách; CHI = Hoàn tiền cho khách';
COMMENT ON COLUMN customer_transactions.payment_method IS 'Phương thức thanh toán';
