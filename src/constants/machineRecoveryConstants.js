export const MACHINE_RECOVERY_STATUSES = [
    { id: 'ALL', label: 'Tất cả', color: 'gray' },
    { id: 'CHO_DUYET', label: 'Chờ duyệt', color: 'amber' },
    { id: 'HOAN_THANH', label: 'Hoàn thành', color: 'emerald' },
    { id: 'HUY', label: 'Đã hủy', color: 'rose' }
];

export const MACHINE_ITEM_CONDITIONS = [
    { id: 'tot', label: 'Tốt' },
    { id: 'loi', label: 'Lỗi nhẹ' },
    { id: 'hong', label: 'Hỏng nặng' },
    { id: 'khac', label: 'Khác' }
];

export const MACHINE_RECOVERY_TABLE_COLUMNS = [
    { key: 'recovery_code', label: 'Mã phiếu' },
    { key: 'recovery_date', label: 'Ngày thu hồi' },
    { key: 'customer_id', label: 'Khách hàng' },
    { key: 'order_id', label: 'Đơn hàng' },
    { key: 'warehouse_id', label: 'Kho nhận' },
    { key: 'driver_name', label: 'NV vận chuyển' },
    { key: 'total_items', label: 'SL máy' },
    { key: 'status', label: 'Trạng thái' }
];
