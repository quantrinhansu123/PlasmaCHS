import { supabase } from '../supabase/config';
import {
    getDefaultViewPermissions,
    mergeWithDefaultViewPermissions,
} from '../constants/departmentViewPermissions';
import { buildPermissionGroupKey } from './permissionGroupKey';

const normalizeRoleKey = (value) => {
    if (!value) return '';
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
};

const getCanonicalRoleNames = (roleName) => {
    const normalized = normalizeRoleKey(roleName);
    const names = [];

    if (roleName) names.push(roleName);
    if (normalized.includes('admin') || normalized.includes('quantri')) names.push('Admin');
    if (normalized.includes('thukho')) names.push('ThuKho');
    if (normalized.includes('shipper') || normalized.includes('giaohang')) names.push('Shipper');
    if (normalized.includes('nvkd') || normalized.includes('kinhdoanh') || normalized.includes('sale')) {
        names.push('NVKD');
    }
    if (normalized.includes('leadsale') || normalized.includes('truongkinhdoanh')) names.push('LeadSale');
    if (normalized.includes('cskh') || normalized.includes('chamsockhachhang')) names.push('CSKH');
    if (normalized.includes('ketoan') || normalized.includes('accountant')) names.push('KeToan');

    return [...new Set(names.filter(Boolean))];
};

/**
 * Lấy quyền xem theo thứ tự ưu tiên (tránh lỗi maybeSingle khi khớp nhiều dòng).
 */
export const fetchRolePermissions = async (roleName, departmentName = '') => {
    const candidates = [];
    const groupKey = buildPermissionGroupKey(departmentName, roleName);
    if (groupKey) candidates.push(groupKey);
    getCanonicalRoleNames(roleName).forEach((name) => {
        if (!candidates.includes(name)) candidates.push(name);
    });

    if (!candidates.length) {
        return getDefaultViewPermissions(departmentName, roleName);
    }

    const { data, error } = await supabase
        .from('app_roles')
        .select('permissions, name')
        .in('name', candidates);

    if (error) {
        console.warn('fetchRolePermissions:', error.message);
        return getDefaultViewPermissions(departmentName, roleName);
    }

    const rows = data || [];
    for (const name of candidates) {
        const row = rows.find((item) => item.name === name);
        if (row?.permissions) {
            return mergeWithDefaultViewPermissions(row.permissions, departmentName, roleName);
        }
    }

    return getDefaultViewPermissions(departmentName, roleName);
};
