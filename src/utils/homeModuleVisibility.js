import {
    isAccountantRole,
    isAdminRole,
    isSalesRole,
    isShipperRole,
    isWarehouseRole,
    normalizeRole,
} from './accessControl';

/** Nhãn phòng ban / vai trò chuẩn hóa cho lưới Trang chủ & sidebar. */
export const HOME_VIEWERS = {
    KINH_DOANH: 'kinhdoanh',
    KHO: 'kho',
    KE_TOAN: 'ketoan',
    ADMIN: 'admin',
    VAN_CHUYEN: 'vanchuyen',
    CSKH: 'cskh',
    HE_THONG: 'hethong',
    ALL: '*',
};

const normalizeViewerKey = (value) => {
    if (!value) return '';
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
};

/** Gắn thẻ viewer từ vai trò hệ thống. */
const tagsFromRole = (role) => {
    const tags = new Set();
    if (!role) return tags;

    const normalized = normalizeRole(role);
    tags.add(normalized);

    if (isAdminRole(role)) tags.add(HOME_VIEWERS.ADMIN);
    if (isSalesRole(role)) tags.add(HOME_VIEWERS.KINH_DOANH);
    if (isWarehouseRole(role)) tags.add(HOME_VIEWERS.KHO);
    if (isAccountantRole(role)) tags.add(HOME_VIEWERS.KE_TOAN);
    if (isShipperRole(role)) tags.add(HOME_VIEWERS.VAN_CHUYEN);

    if (normalized.includes('cskh') || normalized.includes('chamsockhachhang')) {
        tags.add(HOME_VIEWERS.CSKH);
    }
    if (normalized.includes('hethong') || normalized.includes('system')) {
        tags.add(HOME_VIEWERS.HE_THONG);
    }

    return tags;
};

/** Gắn thẻ viewer từ tên phòng ban (users.department). */
const tagsFromDepartment = (department) => {
    const tags = new Set();
    const dep = normalizeViewerKey(department);
    if (!dep) return tags;

    tags.add(dep);

    if (dep.includes('kinhdoanh') || dep.includes('sale')) tags.add(HOME_VIEWERS.KINH_DOANH);
    if (dep.includes('kho') || dep.includes('warehouse')) tags.add(HOME_VIEWERS.KHO);
    if (dep.includes('ketoan') || dep.includes('accountant')) tags.add(HOME_VIEWERS.KE_TOAN);
    if (dep.includes('admin') || dep.includes('quantri')) tags.add(HOME_VIEWERS.ADMIN);
    if (dep.includes('vanchuyen') || dep.includes('shipper') || dep.includes('giaohang')) {
        tags.add(HOME_VIEWERS.VAN_CHUYEN);
    }
    if (dep.includes('cskh') || dep.includes('chamsockhachhang')) tags.add(HOME_VIEWERS.CSKH);
    if (dep.includes('hethong') || dep.includes('system')) tags.add(HOME_VIEWERS.HE_THONG);

    return tags;
};

export const buildUserHomeViewerTags = (role, department) => {
    const tags = new Set([...tagsFromRole(role), ...tagsFromDepartment(department)]);
    return [...tags].filter(Boolean);
};

const tagMatchesAllowed = (userTags, allowedKey) => {
    const allowed = normalizeViewerKey(allowedKey);
    if (!allowed) return false;
    return userTags.some(
        (tag) => tag === allowed || tag.includes(allowed) || allowed.includes(tag)
    );
};

/**
 * Kiểm tra user có được thấy nhóm module trên Trang chủ / sidebar.
 * `homeViewers` trên group: mảng HOME_VIEWERS hoặc ['*'] = mọi người đăng nhập.
 */
export const canViewHomeModule = (group, role, department) => {
    if (isAdminRole(role)) return true;

    const allowed = group?.homeViewers;
    if (!allowed?.length) return true;
    if (allowed.includes(HOME_VIEWERS.ALL)) return true;

    const userTags = buildUserHomeViewerTags(role, department);
    return allowed.some((key) => tagMatchesAllowed(userTags, key));
};
