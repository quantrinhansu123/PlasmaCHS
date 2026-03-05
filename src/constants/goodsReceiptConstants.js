// Constants for Goods Receipt (Nhập Hàng) Management

export const RECEIPT_STATUSES = [
    { id: 'ALL', label: 'Tất cả', color: 'gray' },
    { id: 'CHO_DUYET', label: 'Chờ duyệt', color: 'yellow' },
    { id: 'DA_NHAP', label: 'Đã nhập kho', color: 'blue' },
    { id: 'HOAN_THANH', label: 'Hoàn thành', color: 'green' },
    { id: 'HUY', label: 'Đã hủy', color: 'red' },
];

export const ITEM_TYPES = [
    { id: 'MAY', label: 'Máy' },
    { id: 'BINH', label: 'Bình' },
    { id: 'BINH_CO_KHI', label: 'Bình có khí' },
];

export const ITEM_UNITS = [
    { id: 'cái', label: 'Cái' },
    { id: 'bình', label: 'Bình' },
    { id: 'bộ', label: 'Bộ' },
    { id: 'hộp', label: 'Hộp' },
    { id: 'cuộn', label: 'Cuộn' },
    { id: 'kg', label: 'Kg' },
];

export const RECEIPT_TABLE_COLUMNS = [
    { key: 'receipt_code', label: 'Mã phiếu' },
    { key: 'supplier_name', label: 'Nhà cung cấp' },
    { key: 'warehouse_id', label: 'Kho nhận' },
    { key: 'receipt_date', label: 'Ngày nhập' },
    { key: 'total_items', label: 'Số mặt hàng' },
    { key: 'received_by', label: 'Người nhận' },
    { key: 'status', label: 'Trạng thái' },
];
