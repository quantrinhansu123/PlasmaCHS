// Constants for Permission Matrix

export const PERMISSION_GROUPS = [
    { id: 'system', label: 'Quản lý hệ thống' },
    { id: 'data', label: 'Quản lý dữ liệu' },
    { id: 'delivery', label: 'Quản lý giao nhận & vận chuyển' },
    { id: 'warehouse', label: 'Quản lý kho & hàng hóa' },
];

export const MODULE_PERMISSIONS = [
    { id: 'users', label: 'Quản lý người dùng', path: '/nguoi-dung', group: 'system' },
    { id: 'permissions', label: 'Phân quyền chi tiết', path: '/phan-quyen', group: 'system' },
    { id: 'dashboard', label: 'Thống kê tổng quan', path: '/dashboard', group: 'system' },
    { id: 'reports', label: 'Báo cáo thống kê', path: '/bao-cao', group: 'system' },
    { id: 'customers', label: 'Danh sách khách hàng', path: '/khach-hang', group: 'data' },
    { id: 'machines', label: 'Danh sách máy', path: '/may', group: 'data' },
    { id: 'cylinders', label: 'Danh sách bình', path: '/binh', group: 'data' },
    { id: 'warehouses', label: 'Danh sách kho', path: '/kho', group: 'data' },
    { id: 'suppliers', label: 'Danh sách nhà cung cấp', path: '/nha-cung-cap', group: 'data' },
    { id: 'shippers', label: 'Đơn vị vận chuyển', path: '/don-vi-van-chuyen', group: 'data' },
    { id: 'materials', label: 'Danh sách nguồn vật tư', path: '/nguon-vat-tu', group: 'data' },
    { id: 'promotions', label: 'Danh sách khuyến mãi', path: '/khuyen-mai', group: 'data' },
    { id: 'orders', label: 'Danh sách đơn hàng', path: '/don-hang', group: 'delivery' },
    { id: 'shipping_tasks', label: 'Nhiệm vụ giao hàng', path: '/nhiem-vu-giao-hang', group: 'delivery' },
    { id: 'dnxm', label: 'Đề nghị xuất máy', path: '/de-nghi-xuat-may', group: 'delivery' },
    { id: 'cylinder_recoveries', label: 'Thu hồi vỏ bình', path: '/thu-hoi-vo', group: 'delivery' },
    { id: 'machine_recoveries', label: 'Thu hồi máy', path: '/thu-hoi-may', group: 'warehouse' },
];

export const ACTION_TYPES = [
    { id: 'view', label: 'Xem', colorClass: 'text-blue-700 bg-blue-50 focus:ring-blue-500' },
    { id: 'create', label: 'Thêm', colorClass: 'text-emerald-700 bg-emerald-50 focus:ring-emerald-500' },
    { id: 'edit', label: 'Sửa', colorClass: 'text-amber-700 bg-amber-50 focus:ring-amber-500' },
    { id: 'delete', label: 'Xóa', colorClass: 'text-rose-700 bg-rose-50 focus:ring-rose-500' },
];

export const buildPermissionRows = () =>
    PERMISSION_GROUPS.map((group) => ({
        ...group,
        items: MODULE_PERMISSIONS.filter((module) => module.group === group.id).flatMap((module) =>
            ACTION_TYPES.map((action) => ({
                key: `${module.id}:${action.id}`,
                moduleId: module.id,
                actionId: action.id,
                title: `${action.label} — ${module.label}`,
                description: module.path || module.id,
            })),
        ),
    })).filter((group) => group.items.length > 0);
