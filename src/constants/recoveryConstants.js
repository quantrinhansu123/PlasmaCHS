export const RECOVERY_STATUSES = [
    { id: 'ALL', label: 'Tất cả', color: 'gray' },
    { id: 'CHO_PHAN_CONG', label: 'Chờ phân công', color: 'blue' },
    { id: 'DANG_THU_HOI', label: 'Đang thu hồi', color: 'amber' },
    { id: 'CHO_DUYET', label: 'Chờ duyệt', color: 'yellow' },
    { id: 'HOAN_THANH', label: 'Hoàn thành', color: 'green' },
    { id: 'HUY', label: 'Đã hủy', color: 'red' }
];

export const ITEM_CONDITIONS = [
    { id: 'tot', label: 'Tốt' },
    { id: 'hong', label: 'Hỏng' },
    { id: 'rong', label: 'Rỗng' },
    { id: 'moi', label: 'Mới không dùng' },
    { id: 'khac', label: 'Khác' }
];

export const RECOVERY_TABLE_COLUMNS = [
    { key: 'recovery_code', label: 'Mã phiếu' },
    { key: 'recovery_date', label: 'Ngày thu hồi' },
    { key: 'customer_id', label: 'Khách hàng' },
    { key: 'order_id', label: 'Đơn hàng liên kết' },
    { key: 'warehouse_id', label: 'Kho nhận' },
    { key: 'driver_name', label: 'NV vận chuyển' },
    { key: 'requested_quantity', label: 'SL yêu cầu' },
    { key: 'total_items', label: 'SL thực tế' },
    { key: 'created_by', label: 'Người tạo' },
    { key: 'status', label: 'Trạng thái' }
];
