-- SQL Schema for Goods Issues (Phiếu Xuất Kho)

-- Enum nếu chưa có, hoặc sử dụng VARCHAR check constraint
-- Bảng chứa thông tin phiếu xuất
CREATE TABLE goods_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_code VARCHAR(100) NOT NULL UNIQUE, -- Mã phiếu xuất (VD: PX2411001)
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Ngày xuất
    issue_type VARCHAR(50) NOT NULL, -- 'TRA_NCC', 'HUY_XUAT', 'KHAC'
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL, -- Nhà cung cấp (nếu là xuất trả NCC)
    warehouse_id VARCHAR(50) NOT NULL, -- Kho xuất
    notes TEXT, -- Ghi chú
    total_items INTEGER DEFAULT 0, -- Tổng số lượng
    status VARCHAR(50) NOT NULL DEFAULT 'CHO_DUYET', -- Trạng thái (CHO_DUYET, DA_XUAT, vv)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng chi tiết sản phẩm trong phiếu xuất
CREATE TABLE goods_issue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES goods_issues(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'MAY', 'BINH', 'VAT_TU'
    item_id UUID, -- Liên kết đến id của cylinders / machines (tuỳ mục đích)
    item_code VARCHAR(100), -- Serial / mã RFID nhập vào
    quantity INTEGER NOT NULL DEFAULT 1, -- Số lượng xuất
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Constraints
ALTER TABLE goods_issues ADD CONSTRAINT check_issue_status CHECK (
    status IN ('ALL', 'CHO_DUYET', 'DA_XUAT', 'HOAN_THANH', 'HUY')
);

ALTER TABLE goods_issues ADD CONSTRAINT check_issue_type CHECK (
    issue_type IN ('TRA_NCC', 'HUY_XUAT', 'KHAC')
);

ALTER TABLE goods_issue_items ADD CONSTRAINT check_issue_item_type CHECK (
    item_type IN ('MAY', 'BINH', 'VAT_TU')
);

-- Comments
COMMENT ON TABLE goods_issues IS 'Bảng Phiếu Xuất Kho (trả vỏ, xuất huỷ...)';
COMMENT ON TABLE goods_issue_items IS 'Chi tiết các mã tài sản/sản phẩm được xuất';
