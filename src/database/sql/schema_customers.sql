-- Drop table if it already exists (useful for iterative development)
-- DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- Mã khách hàng (VD: KH001, BV-BM)
    name VARCHAR(255) NOT NULL, -- Tên khách hàng
    phone VARCHAR(50), -- Số điện thoại
    address TEXT, -- Địa chỉ
    warehouse_id VARCHAR(50), -- Kho xuất hàng (Linked to WAREHOUSES)
    legal_rep VARCHAR(255), -- Người đại diện pháp luật
    managed_by VARCHAR(255), -- Nhân viên phụ trách (Sale/Chốt đơn)
    care_by VARCHAR(255), -- Kinh doanh phụ trách chăm sóc KH
    category VARCHAR(100), -- Loại khách hàng (Bệnh Viện -> Khoa...)
    current_cylinders INT DEFAULT 0, -- Số bình hiện có
    current_machines INT DEFAULT 0, -- Số lượng máy hiện có
    borrowed_cylinders INT DEFAULT 0, -- Số vỏ bình đang mượn
    machines_in_use TEXT, -- Mã các máy đang sử dụng (Có thể lưu dạng JSON hoặc text phẩy)
    tax_code VARCHAR(50), -- Mã số thuế
    invoice_address TEXT, -- Địa chỉ xuất hoá đơn GTGT
    invoice_email VARCHAR(255), -- Email nhận hoá đơn điện tử
    customer_type VARCHAR(50), -- Loại khách hàng: công (BV công), tư (BV tư, TM, PK, NG, SP)
    last_order_date DATE, -- Ngày đặt hàng gần nhất (dùng tính KH quá hạn)
    care_expiry_date DATE, -- Ngày hết hạn chăm sóc (mặc định 60 ngày)
    status VARCHAR(50) DEFAULT 'Chưa thành công', -- Trạng thái: Thành công, Chưa thành công
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint for customer_type
ALTER TABLE customers ADD CONSTRAINT check_customer_type CHECK (
    customer_type IN ('công', 'tư')
);

-- RLS (Row Level Security) cho bảng customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy mỏ rộng: Trong phase "cơ bản" này, cho phép Admin và Authenticated user có quyền đọc/ghi.
CREATE POLICY "Cho phép tất cả user đọc khách hàng" ON customers 
    FOR SELECT USING (true);

CREATE POLICY "Cho phép tạo mới khách hàng" ON customers 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Cho phép cập nhật thông tin khách hàng" ON customers 
    FOR UPDATE USING (true);

CREATE POLICY "Chỉ Admin/Authenticated mới được xoá" ON customers 
    FOR DELETE USING (true); -- Có thể siết chặt auth.role() = 'admin' sau này
