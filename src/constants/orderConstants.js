// Shared Constants for Order Management

export const MOCK_CUSTOMERS = [
    { id: 1, name: 'Bệnh viện Hồng Ngọc', address: 'Số 1 đường Phạm Hồng Thái, Hà Nội', recipient: 'Vũ Văn A', phone: '0399749111', category: 'BV' },
    { id: 2, name: 'Thẩm mỹ viện Kangnam', address: '190 Trường Chinh, Đống Đa, Hà Nội', recipient: 'Nguyễn Thị B', phone: '0988123456', category: 'TM' },
    { id: 3, name: 'Phòng khám Đa khoa Medlatec', address: '42 Nghĩa Dũng, Ba Đình, Hà Nội', recipient: 'Trần Văn C', phone: '0911222333', category: 'PK' },
];


export const ORDER_TYPES = [
    { id: 'THUONG', label: 'Đơn bán / Thuê' },
    { id: 'DEMO', label: 'Đơn dùng thử (Demo)' },
    { id: 'NGOAI_GIAO', label: 'Đơn ngoại giao' },
    { id: 'NGHIEN_CUU', label: 'Đơn nghiên cứu' },
];

export const CUSTOMER_CATEGORIES = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'BV', label: 'Bệnh viện' },
    { id: 'TM', label: 'Thẩm mỹ viện' },
    { id: 'PK', label: 'Phòng khám' },
    { id: 'NG', label: 'Khách ngoại giao' },
    { id: 'SP', label: 'Spa / Khác' },
];

export const PRODUCT_TYPES = [
    { id: 'BINH_4L', label: 'Bình 4L' },
    { id: 'BINH_8L', label: 'Bình 8L' },
    { id: 'MAY_ROSY', label: 'Máy PlasmaRosy' },
    { id: 'MAY_MED', label: 'Máy PlasmaMed-BV' },
];

export const ORDER_STATUSES = [
    { id: 'ALL', label: 'Tất cả', color: 'gray' },
    { id: 'CHO_DUYET', label: 'Chờ KD duyệt', color: 'yellow' },
    { id: 'CHO_CTY_DUYET', label: 'Chờ Cty duyệt', color: 'orange' },
    { id: 'KHO_XU_LY', label: 'Kho đang xử lý', color: 'blue' },
    { id: 'DIEU_CHINH', label: 'Điều chỉnh', color: 'orange' },
    { id: 'DA_DUYET', label: 'Đã xuất kho', color: 'indigo' },
    { id: 'CHO_GIAO_HANG', label: 'Chờ giao hàng', color: 'indigo' },
    { id: 'DANG_GIAO_HANG', label: 'Đang giao hàng', color: 'purple' },
    { id: 'CHO_DOI_SOAT', label: 'Chờ đối soát', color: 'cyan' },
    { id: 'DOI_SOAT_THAT_BAI', label: 'Đối soát thất bại', color: 'red' },
    { id: 'HOAN_THANH', label: 'Hoàn thành', color: 'green' },
    { id: 'HUY_DON', label: 'Hủy đơn', color: 'red' },
];

export const TABLE_COLUMNS = [
    { key: 'code', label: 'Mã ĐH' },
    { key: 'category', label: 'Loại khách' },
    { key: 'customer', label: 'Khách hàng' },
    { key: 'recipient', label: 'Người nhận' },
    { key: 'type', label: 'Loại đơn' },
    { key: 'product', label: 'Hàng hóa' },
    { key: 'quantity', label: 'Số lượng' },
    { key: 'department', label: 'Mã máy' },
    { key: 'cylinders', label: 'Mã bình' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'date', label: 'Ngày đặt' },
];

export const ORDER_ROLES = {
    ADMIN: 'admin',
    SALE: 'sale',
    LEAD_SALE: 'lead_sale',
    THU_KHO: 'thu_kho',
    SHIPPER: 'shipper',
    CUSTOMER: 'customer'
};

export const ORDER_STATE_TRANSITIONS = {
    'CHO_DUYET': [
        { nextStatus: 'DIEU_CHINH', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.LEAD_SALE], label: 'Yêu cầu điều chỉnh' },
        { nextStatus: 'CHO_CTY_DUYET', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.LEAD_SALE], label: 'Lead KD Duyệt' },
        { nextStatus: 'HUY_DON', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.LEAD_SALE, ORDER_ROLES.SALE], label: 'Hủy đơn' }
    ],
    'CHO_CTY_DUYET': [
        { nextStatus: 'DIEU_CHINH', allowedRoles: [ORDER_ROLES.ADMIN], label: 'Yêu cầu KD điều chỉnh' },
        { nextStatus: 'KHO_XU_LY', allowedRoles: [ORDER_ROLES.ADMIN], label: 'Cty Duyệt (Chuyển Kho)' },
        { nextStatus: 'HUY_DON', allowedRoles: [ORDER_ROLES.ADMIN], label: 'Hủy đơn' }
    ],
    'KHO_XU_LY': [
        { nextStatus: 'DA_DUYET', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.THU_KHO], label: 'Kho xác nhận xuất' }
    ],
    'DIEU_CHINH': [
        { nextStatus: 'CHO_DUYET', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SALE], label: 'Gửi lại chờ duyệt' },
        { nextStatus: 'HUY_DON', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SALE, ORDER_ROLES.CUSTOMER], label: 'Hủy đơn' }
    ],
    'DA_DUYET': [
        { nextStatus: 'CHO_GIAO_HANG', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.THU_KHO], label: 'Gán ĐVVC / Chờ giao' }
    ],
    'CHO_GIAO_HANG': [
        { nextStatus: 'DANG_GIAO_HANG', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.THU_KHO, ORDER_ROLES.SHIPPER], label: 'Bắt đầu giao' }
    ],
    'DANG_GIAO_HANG': [
        { nextStatus: 'CHO_DOI_SOAT', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SHIPPER], label: 'Giao xong (Chờ đối soát)' },
        { nextStatus: 'HOAN_THANH', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SHIPPER], label: 'Giao thành công' }
    ],
    'CHO_DOI_SOAT': [
        { nextStatus: 'HOAN_THANH', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SALE, ORDER_ROLES.CUSTOMER], label: 'Khách xác nhận' },
        { nextStatus: 'DOI_SOAT_THAT_BAI', allowedRoles: [ORDER_ROLES.ADMIN, ORDER_ROLES.SALE, ORDER_ROLES.CUSTOMER], label: 'Xác nhận thất bại' }
    ]
};
