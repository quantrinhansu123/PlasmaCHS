import { supabase } from '../supabase/config';
import {
    getDataVisibilityScope,
    hasFullDataVisibility,
    isLeadSaleRole,
    isShipperRole,
    isThuKhoRole,
    isWarehouseRole,
} from './accessControl';

export const escapePostgrestValue = (value) =>
    String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

export const getCurrentUserNames = (user) => {
    const storageUserName =
        localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    return [
        ...new Set(
            [user?.name, user?.username, storageUserName]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ),
    ];
};

export const getManagedNamesFromUser = (user) =>
    String(user?.nguoi_quan_ly || '')
        .split(/[,;/|]+/)
        .map((name) => name.trim())
        .filter(Boolean);

/** Trưởng nhóm: vai trò LeadSale (hoặc tương đương trong accessControl) */
export const isTeamLeaderUser = (role) => isLeadSaleRole(role);

export const getEffectiveVisibilityScope = (role, roleScope) => {
    if (hasFullDataVisibility(role) || roleScope === 'all') return 'all';

    if (roleScope === 'team' || isTeamLeaderUser(role)) return 'team';
    if (roleScope === 'own') return 'own';

    const fromRole = getDataVisibilityScope(role);
    if (fromRole === 'all') return 'all';
    if (fromRole === 'team' || isTeamLeaderUser(role)) return 'team';
    if (fromRole === 'warehouse' || fromRole === 'assigned_orders') return fromRole;
    return 'own';
};

/** Chưa sẵn sàng lọc theo NV — tránh query `__no_match__` khi role/profile đang tải */
export const isSalesAssigneeScopePending = (role, roleScope, names) => {
    if (hasFullDataVisibility(role) || roleScope === 'all') return false;
    const scope = getEffectiveVisibilityScope(role, roleScope);
    if (scope !== 'own' && scope !== 'team') return false;
    return names === null || names === undefined;
};

/** Admin + Kế toán: xem toàn bộ đơn */
export const hasFullOrderVisibility = (role, roleScope) =>
    getEffectiveVisibilityScope(role, roleScope) === 'all';

/** Thủ kho / nhân viên kho: lọc đơn theo kho quản lý */
export const shouldScopeOrdersByWarehouse = (role) => {
    if (hasFullDataVisibility(role)) return false;
    return isThuKhoRole(role) || isWarehouseRole(role);
};

/** NVKD / trưởng nhóm: lọc theo ordered_by (người yêu cầu / người đặt) */
export const shouldScopeOrdersBySalesPerson = (role, roleScope) => {
    if (hasFullOrderVisibility(role, roleScope)) return false;
    if (isShipperRole(role)) return false;
    if (shouldScopeOrdersByWarehouse(role)) return false;
    return true;
};

/** Khách hàng / lead: lọc theo managed_by + care_by */
export const shouldScopeCustomersByAssignee = (role, roleScope) => {
    const scope = getEffectiveVisibilityScope(role, roleScope);
    return scope === 'own' || scope === 'team';
};

/**
 * Danh sách tên NVKD dùng lọc ordered_by / managed_by / care_by.
 * @returns {{ scope: 'all'|'team'|'own'|'warehouse'|'assigned_orders', names: string[]|null }}
 */
export async function resolveVisibleSalesNames(user, role, { roleScope } = {}) {
    const scope = getEffectiveVisibilityScope(role, roleScope);
    const currentNames = getCurrentUserNames(user);

    if (scope === 'all' || scope === 'warehouse' || scope === 'assigned_orders') {
        return { scope, names: null };
    }

    if (scope === 'team') {
        const teamNames = [...getManagedNamesFromUser(user)];
        const teamCode = String(user?.team || '').trim();

        if (teamCode) {
            try {
                const { data } = await supabase
                    .from('app_users')
                    .select('name, username')
                    .eq('team', teamCode);

                (data || []).forEach((row) => {
                    if (row.name?.trim()) teamNames.push(row.name.trim());
                    if (row.username?.trim()) teamNames.push(row.username.trim());
                });
            } catch (error) {
                console.warn('resolveVisibleSalesNames: load team failed', error);
            }
        }

        return {
            scope,
            names: [...new Set([...currentNames, ...teamNames])],
        };
    }

    if (!currentNames.length) {
        return { scope, names: null };
    }
    return { scope, names: currentNames };
}

export const appendOrderedByScope = (query, names) => {
    if (names === null) return query;
    if (!names?.length) return query.in('ordered_by', ['__no_match__']);
    return query.in('ordered_by', names);
};

export const appendCustomerAssigneeScope = (query, names) => {
    if (names === null) return query;
    if (!names?.length) {
        return query.or('managed_by.eq.__no_match__,care_by.eq.__no_match__');
    }
    const conditions = names.flatMap((name) => {
        const escaped = escapePostgrestValue(name);
        return [`managed_by.eq."${escaped}"`, `care_by.eq."${escaped}"`];
    });
    return query.or(conditions.join(','));
};
