const PUBLIC_PATHS = new Set(['/ho-so', '/trang-chu']);

const ROUTE_RULES = [
    { prefix: '/trang-chu', module: 'dashboard' },
    { prefix: '/thong-ke', module: 'dashboard' },
    { prefix: '/bao-cao/', module: 'reports' },

    { prefix: '/don-hang-kinh-doanh', anyOfModules: ['orders', 'customers', 'promotions', 'dnxm', 'reports'] },
    { prefix: '/don-hang', module: 'orders' },
    { prefix: '/danh-sach-dieu-chuyen', module: 'orders' },
    { prefix: '/danh-sach-hang-luan-chuyen', module: 'orders' },
    { prefix: '/de-nghi-xuat-may', module: 'dnxm' },
    { prefix: '/lich-su-giao-hang', module: 'shipping_tasks' },

    { prefix: '/quan-ly-thiet-bi', anyOfModules: ['machines', 'cylinders', 'reports'] },
    { prefix: '/may', module: 'machines' },
    { prefix: '/binh', module: 'cylinders' },
    { prefix: '/phieu-sua-chua', module: 'machines' },

    { prefix: '/kho', anyOfModules: ['warehouses', 'reports'] },
    { prefix: '/kho/dieu-chuyen', module: 'warehouses' },

    { prefix: '/mua-hang-nha-cung-cap', module: 'suppliers' },
    { prefix: '/nha-cung-cap', module: 'suppliers' },
    { prefix: '/nhap-hang', module: 'suppliers' },
    { prefix: '/xuat-tra-ncc', module: 'suppliers' },

    { prefix: '/van-chuyen', anyOfModules: ['shippers', 'shipping_tasks'] },
    { prefix: '/don-vi-van-chuyen', module: 'shippers' },
    { prefix: '/nhiem-vu-giao-hang', module: 'shipping_tasks' },

    { prefix: '/thu-hoi', anyOfModules: ['cylinder_recoveries', 'machine_recoveries'] },
    { prefix: '/thu-hoi-vo', module: 'cylinder_recoveries' },
    { prefix: '/thu-hoi-may', module: 'machine_recoveries' },
    { prefix: '/don-hang-tra-ve', module: 'cylinder_recoveries' },

    { prefix: '/vat-tu', module: 'materials' },
    { prefix: '/he-thong', anyOfModules: ['users', 'permissions'] },
    { prefix: '/nguoi-dung', module: 'users' },
    { prefix: '/phan-quyen', module: 'permissions' },
    { prefix: '/khuyen-mai', module: 'promotions' },
    { prefix: '/khach-hang', module: 'customers' },
    { prefix: '/khach-hang-lead', module: 'customers' },
];

const SORTED_RULES = [...ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

export const normalizeRole = (role) => {
    if (!role) return '';
    return String(role)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
};

export const isAdminRole = (role) => {
    const r = normalizeRole(role);
    return r === 'admin' || r === 'quantri' || r === 'company' || r === 'congty' || r === 'manager' || r === 'quanly';
};

export const isSalesRole = (role) => {
    const r = normalizeRole(role);
    return r.includes('nvkd') || r.includes('nhanvienkinhdoanh') || r.includes('kinhdoanh') || r.includes('sale');
};

export const isLeadSaleRole = (role) => {
    const r = normalizeRole(role);
    return r.includes('leadsale') || r.includes('truongkinhdoanh') || r.includes('lead');
};

export const isWarehouseRole = (role) => {
    const r = normalizeRole(role);
    return r.includes('thukho') || r.includes('kho') || r.includes('warehouse');
};

export const isShipperRole = (role) => {
    const r = normalizeRole(role);
    return r.includes('shipper') || r.includes('giaohang');
};

export const getDataVisibilityScope = (role) => {
    if (isAdminRole(role)) return 'all';
    if (isLeadSaleRole(role)) return 'team';
    if (isSalesRole(role)) return 'own';
    if (isWarehouseRole(role)) return 'warehouse';
    if (isShipperRole(role)) return 'assigned_orders';
    return 'own';
};

export const hasModuleView = (permissions, moduleId) => {
    return Boolean(permissions?.[moduleId]?.view);
};

export const canAccessPath = (pathname, role, permissions) => {
    if (!pathname) return false;
    if (isAdminRole(role)) return true;
    if (PUBLIC_PATHS.has(pathname)) return true;

    const rule = SORTED_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
    if (!rule) {
        return false;
    }

    if (rule.module) {
        return hasModuleView(permissions, rule.module);
    }

    if (rule.anyOfModules) {
        return rule.anyOfModules.some((moduleId) => hasModuleView(permissions, moduleId));
    }

    return false;
};

export const getDefaultLandingPath = (role, permissions) => {
    if (isAdminRole(role)) return '/trang-chu';

    if (hasModuleView(permissions, 'dashboard')) return '/trang-chu';
    if (hasModuleView(permissions, 'shipping_tasks')) return '/nhiem-vu-giao-hang';
    if (hasModuleView(permissions, 'ho_so')) return '/ho-so';

    return '/ho-so';
};
