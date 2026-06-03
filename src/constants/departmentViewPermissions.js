import { createEmptyViewPermissions } from './permissionConstants';
import {
    HOME_VIEWERS,
    buildUserHomeViewerTags,
} from '../utils/homeModuleVisibility';
import { isAdminRole } from '../utils/accessControl';

/** Module «xem» theo từng phân hệ (đồng bộ với lưới Trang chủ). */
const MODULES_BY_AREA = {
    business: ['orders', 'customers', 'promotions', 'dnxm', 'reports'],
    equipment: ['machines', 'cylinders', 'reports'],
    warehouse: ['warehouses'],
    supplier: ['suppliers'],
    shipping: ['shippers', 'shipping_tasks'],
    recovery: ['cylinder_recoveries', 'machine_recoveries'],
    system: ['users', 'permissions', 'dashboard'],
    materials: ['materials'],
};

/** Phòng ban/vai trò → các phân hệ được xem (theo yêu cầu Trang chủ). */
const VIEWER_AREAS = {
    [HOME_VIEWERS.KINH_DOANH]: ['business', 'recovery'],
    [HOME_VIEWERS.KHO]: ['business', 'equipment', 'warehouse', 'supplier'],
    [HOME_VIEWERS.KE_TOAN]: ['business', 'equipment', 'warehouse', 'supplier'],
    [HOME_VIEWERS.ADMIN]: Object.keys(MODULES_BY_AREA),
    [HOME_VIEWERS.VAN_CHUYEN]: ['shipping'],
    [HOME_VIEWERS.CSKH]: ['recovery', 'business'],
    [HOME_VIEWERS.HE_THONG]: ['system'],
};

/** Ticket sửa chữa: mọi nhóm đều xem được danh sách máy (route /phieu-sua-chua). */
const UNIVERSAL_VIEW_MODULES = ['machines'];

const setView = (permissions, moduleIds, enabled = true) => {
    moduleIds.forEach((id) => {
        if (!permissions[id]) permissions[id] = { view: false };
        permissions[id].view = enabled;
    });
};

/**
 * Mẫu quyền xem mặc định theo Phòng ban + Vị trí (dùng tại /phan-quyen và khi chưa có bản ghi DB).
 */
export const getDefaultViewPermissions = (department = '', position = '') => {
    const permissions = createEmptyViewPermissions();

    if (isAdminRole(position) || isAdminRole(department)) {
        Object.keys(permissions).forEach((id) => {
            permissions[id].view = true;
        });
        return permissions;
    }

    const tags = buildUserHomeViewerTags(position, department);
    const areas = new Set();

    tags.forEach((tag) => {
        (VIEWER_AREAS[tag] || []).forEach((area) => areas.add(area));
    });

    areas.forEach((area) => setView(permissions, MODULES_BY_AREA[area] || []));
    setView(permissions, UNIVERSAL_VIEW_MODULES);

    return permissions;
};

/** Gộp quyền DB với mẫu: module đã lưu trong DB giữ nguyên; module thiếu thì lấy mẫu phòng ban. */
export const mergeWithDefaultViewPermissions = (saved = {}, department = '', position = '') => {
    const defaults = getDefaultViewPermissions(department, position);
    const merged = { ...defaults };

    Object.keys(saved || {}).forEach((moduleId) => {
        if (saved[moduleId] && typeof saved[moduleId].view === 'boolean') {
            merged[moduleId] = { view: saved[moduleId].view };
        }
    });

    return merged;
};
