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

export const TABLE_COLUMNS = [
    { key: 'code', label: 'Mã phiếu' },
    { key: 'supplier', label: 'Nhà cung cấp' },
    { key: 'warehouse', label: 'Kho nhận' },
    { key: 'date', label: 'Ngày nhập' },
    { key: 'items', label: 'Số dòng' },
    { key: 'items_summary', label: 'Mặt hàng' },
    { key: 'amount', label: 'Tổng giá trị' },
    { key: 'deliverer', label: 'Người giao' },
    { key: 'deliverer_address', label: 'Địa chỉ giao hàng' },
    { key: 'status', label: 'Trạng thái' },
];
