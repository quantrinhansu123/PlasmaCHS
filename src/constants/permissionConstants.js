// Constants for Permission Matrix

export const MODULE_PERMISSIONS = [
    { id: 'orders', label: 'Danh sách đơn hàng' },
    { id: 'customers', label: 'Danh sách khách hàng' },
    { id: 'machines', label: 'Danh sách máy' },
    { id: 'cylinders', label: 'Danh sách bình' },
    { id: 'warehouses', label: 'Danh sách kho' },
    { id: 'suppliers', label: 'Danh sách nhà cung cấp' },
    { id: 'shippers', label: 'Đơn vị vận chuyển' },
    { id: 'materials', label: 'Danh sách nguồn vật tư' },
    { id: 'promotions', label: 'Danh sách khuyến mãi' },
    { id: 'cylinder_recoveries', label: 'Thu hồi vỏ bình' },
    { id: 'machine_recoveries', label: 'Thu hồi máy' },
    { id: 'shipping_tasks', label: 'Nhiệm vụ giao hàng' },
    { id: 'users', label: 'Quản lý người dùng' },
    { id: 'permissions', label: 'Phân quyền chi tiết' },
    { id: 'reports', label: 'Báo cáo thống kê' },
    { id: 'dashboard', label: 'Thống kê tổng quan' }
];

export const ACTION_TYPES = [
    { id: 'view', label: 'Xem', colorClass: 'text-blue-700 bg-blue-50 focus:ring-blue-500' },
    { id: 'create', label: 'Thêm', colorClass: 'text-emerald-700 bg-emerald-50 focus:ring-emerald-500' },
    { id: 'edit', label: 'Sửa', colorClass: 'text-amber-700 bg-amber-50 focus:ring-amber-500' },
    { id: 'delete', label: 'Xóa', colorClass: 'text-rose-700 bg-rose-50 focus:ring-rose-500' }
];
