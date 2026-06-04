import { supabase } from '../supabase/config';
import { splitMultiValue } from './multiValueField';
import {
    hasFullDataVisibility,
    isDepartmentHeadRole,
    isShipperRole,
    isThuKhoRole,
    isWarehouseRole,
} from './accessControl';

export const escapePostgrestValue = (value) =>
    String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

/** Chuẩn hóa tên để so khớp Nhân viên KD ↔ Người quản lý */
export const normalizeSalesPersonKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

export const getCurrentUserNames = (user) => {
    const storageUserName =
        localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    return [
        ...new Set(
            [user?.name, user?.username, storageUserName]
                .map((value) => String(value || '').trim())
                .filter(Boolean),
        ),
    ];
};

/** Admin + Kế toán (+ phòng Admin): xem toàn bộ đơn */
export const hasFullOrderVisibility = (role, roleScope, department = '') =>
    hasFullDataVisibility(role, department) || roleScope === 'all';

/** Thủ kho / nhân viên kho: lọc đơn theo kho quản lý */
export const shouldScopeOrdersByWarehouse = (role, department = '') => {
    if (hasFullDataVisibility(role, department)) return false;
    return isThuKhoRole(role) || isWarehouseRole(role);
};

/**
 * Lọc danh sách đơn: cột Nhân viên KD (`ordered_by`) = tên mình hoặc NV có Người quản lý trùng mình.
 */
export const shouldScopeOrdersBySalesPerson = (role, roleScope, department = '') => {
    if (hasFullOrderVisibility(role, roleScope, department)) return false;
    if (isShipperRole(role)) return false;
    if (shouldScopeOrdersByWarehouse(role)) return false;
    return true;
};

/** Chưa sẵn sàng lọc — tránh query rỗng khi profile đang tải */
export const isSalesAssigneeScopePending = (role, roleScope, names, department = '') => {
    if (!shouldScopeOrdersBySalesPerson(role, roleScope, department)) return false;
    return names === null || names === undefined;
};

/** Khách hàng / lead: lọc theo managed_by + care_by */
export const shouldScopeCustomersByAssignee = (role, roleScope, department = '') =>
    shouldScopeOrdersBySalesPerson(role, roleScope, department);

const nameKeyMatchesAllowed = (candidate, allowedKeys) => {
    const key = normalizeSalesPersonKey(candidate);
    if (!key) return false;
    for (const allowed of allowedKeys) {
        if (key === allowed || key.includes(allowed) || allowed.includes(key)) return true;
    }
    return false;
};

async function fetchTeamMemberNames(teamCode = '') {
    const code = String(teamCode || '').trim();
    if (!code) return [];

    try {
        const { data, error } = await supabase
            .from('app_users')
            .select('name, username')
            .eq('team', code);

        if (error) {
            console.warn('fetchTeamMemberNames:', error.message);
            return [];
        }

        const names = [];
        (data || []).forEach((row) => {
            if (row.name?.trim()) names.push(row.name.trim());
            if (row.username?.trim()) names.push(row.username.trim());
        });
        return names;
    } catch (error) {
        console.warn('fetchTeamMemberNames:', error);
        return [];
    }
}

/** NV cùng phòng ban (trưởng phòng xem phiếu của cả phòng). */
async function fetchDepartmentMemberNames(department = '') {
    const depKey = normalizeSalesPersonKey(department);
    if (!depKey) return [];

    try {
        const { data, error } = await supabase.from('app_users').select('name, username, department');
        if (error) {
            console.warn('fetchDepartmentMemberNames:', error.message);
            return [];
        }

        const names = [];
        (data || []).forEach((row) => {
            if (normalizeSalesPersonKey(row.department) !== depKey) return;
            if (row.name?.trim()) names.push(row.name.trim());
            if (row.username?.trim()) names.push(row.username.trim());
        });
        return names;
    } catch (error) {
        console.warn('fetchDepartmentMemberNames:', error);
        return [];
    }
}
export async function fetchSubordinateSalesNames(managerNames = []) {
    const managerKeys = new Set(managerNames.map(normalizeSalesPersonKey).filter(Boolean));
    if (!managerKeys.size) return [];

    try {
        const { data, error } = await supabase
            .from('app_users')
            .select('name, username, nguoi_quan_ly');

        if (error) {
            console.warn('fetchSubordinateSalesNames:', error.message);
            return [];
        }

        const subordinates = [];
        (data || []).forEach((row) => {
            const managers = splitMultiValue(row.nguoi_quan_ly);
            const reportsToCurrentUser = managers.some((managerName) =>
                managerKeys.has(normalizeSalesPersonKey(managerName)),
            );
            if (!reportsToCurrentUser) return;
            if (row.name?.trim()) subordinates.push(row.name.trim());
            if (row.username?.trim()) subordinates.push(row.username.trim());
        });

        return [...new Set(subordinates)];
    } catch (error) {
        console.warn('fetchSubordinateSalesNames:', error);
        return [];
    }
}

/**
 * Tên hiển thị ở cột Nhân viên KD trên đơn (ưu tiên ordered_by).
 */
export const getOrderSalesPersonLabel = (order) =>
    String(order?.ordered_by || order?.sales_person || '').trim();

/** Trích «Nhân viên phụ trách máy» từ ghi chú phiếu ĐNXM. */
export const parseMachineManagerFromNote = (note) => {
    const match = String(note || '').match(/Phụ trách máy:\s*([^\n\r.]+)/i);
    return (match?.[1] || '').trim();
};

/** Nhãn NV phụ trách trên phiếu ĐNXM (form: «Nhân viên phụ trách máy»). */
export const getOrderMachineManagerLabel = (order) => {
    const fromNote = parseMachineManagerFromNote(order?.note);
    if (fromNote) return fromNote;
    return getOrderSalesPersonLabel(order);
};

/** Đơn có Nhân viên KD thuộc danh sách được xem (mình + NV phụ trách). */
export const orderMatchesVisibleSalesPerson = (order, visibleNames = []) => {
    if (!visibleNames?.length) return false;
    const salesKey = normalizeSalesPersonKey(getOrderSalesPersonLabel(order));
    if (!salesKey) return false;
    const allowed = new Set(visibleNames.map(normalizeSalesPersonKey));
    return allowed.has(salesKey);
};

export const filterOrdersByVisibleSalesPerson = (orders = [], visibleNames = []) => {
    if (!visibleNames?.length) return [];
    return orders.filter((order) => orderMatchesVisibleSalesPerson(order, visibleNames));
};

/** ĐNXM: khớp NV phụ trách máy hoặc người đề nghị (ordered_by). */
export const orderMatchesVisibleMachineRequest = (order, visibleNames = []) => {
    if (!visibleNames?.length) return false;
    const allowed = visibleNames.map(normalizeSalesPersonKey).filter(Boolean);
    if (!allowed.length) return false;

    const candidates = [
        getOrderMachineManagerLabel(order),
        getOrderSalesPersonLabel(order),
        parseMachineManagerFromNote(order?.note),
        order?.ordered_by,
    ].filter(Boolean);

    return candidates.some((candidate) => nameKeyMatchesAllowed(candidate, allowed));
};

export const filterOrdersByVisibleMachineRequest = (orders = [], visibleNames = []) => {
    if (!visibleNames?.length) return [];
    return orders.filter((order) => orderMatchesVisibleMachineRequest(order, visibleNames));
};

/** @deprecated — dùng filterOrdersByVisibleMachineRequest */
export const orderMatchesVisibleMachineManager = (order, visibleNames = []) =>
    orderMatchesVisibleMachineRequest(order, visibleNames);

/** @deprecated — dùng filterOrdersByVisibleMachineRequest */
export const filterOrdersByVisibleMachineManager = (orders = [], visibleNames = []) =>
    filterOrdersByVisibleMachineRequest(orders, visibleNames);

/** Query ĐNXM: ordered_by hoặc dòng «Phụ trách máy» trong note. */
export const appendMachineRequestAssigneeScope = (query, names) => {
    if (names === null) return query;
    if (!names?.length) return query.in('ordered_by', ['__no_match__']);

    const parts = names.flatMap((name) => {
        const escaped = escapePostgrestValue(name);
        const notePattern = `%Phụ trách máy: ${escaped}%`;
        return [`ordered_by.eq."${escaped}"`, `note.ilike."${notePattern}"`];
    });
    return query.or(parts.join(','));
};

/**
 * Danh sách tên Nhân viên KD được xem:
 * - chính mình
 * - NV có Người quản lý (app_users.nguoi_quan_ly) khớp tên đăng nhập
 */
export async function resolveVisibleSalesNames(user, role, { roleScope, department } = {}) {
    if (hasFullOrderVisibility(role, roleScope, department)) {
        return { scope: 'all', names: null };
    }

    if (isShipperRole(role)) {
        return { scope: 'assigned_orders', names: null };
    }

    if (shouldScopeOrdersByWarehouse(role)) {
        return { scope: 'warehouse', names: null };
    }

    const currentNames = getCurrentUserNames(user);
    if (!currentNames.length) {
        return { scope: 'manager', names: null };
    }

    const subordinates = await fetchSubordinateSalesNames(currentNames);
    const teamNames = [...subordinates];

    if (isDepartmentHeadRole(role)) {
        if (user?.department) {
            teamNames.push(...(await fetchDepartmentMemberNames(user.department)));
        }
        if (user?.team) {
            teamNames.push(...(await fetchTeamMemberNames(user.team)));
        }
    }

    return {
        scope: 'manager',
        names: [...new Set([...currentNames, ...teamNames])],
    };
}

/** Lọc query theo cột Nhân viên KD (`ordered_by`). */
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
