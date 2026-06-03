import { supabase } from '../supabase/config';
import {
    hasFullDataVisibility,
    isThuKhoRole as isThuKhoRoleHelper,
    isWarehouseRole as isWarehouseRoleHelper,
    normalizeRole,
} from './accessControl';

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

export const extractWarehouseFromNote = (note) => {
    const text = String(note || '');
    if (!text) return '';
    const match = text.match(/Kho:\s*([^\n\r.]+)/i);
    return (match?.[1] || '').trim();
};

/** Giá trị thô cột Kho (mã / id / tên — dùng lọc). */
export const getOrderWarehouseLabel = (order) =>
    String(order?.warehouse || '').trim() || extractWarehouseFromNote(order?.note);

/** Map id / code / tên kho → tên hiển thị. */
export const buildWarehouseLabelMap = (warehouses = []) => {
    const map = new Map();
    for (const warehouse of warehouses) {
        const name = String(warehouse?.name || '').trim();
        if (!name) continue;
        const id = String(warehouse?.id || '').trim();
        const code = String(warehouse?.code || '').trim();
        if (id) map.set(id, name);
        if (code) map.set(code, name);
        map.set(name, name);
        map.set(normalizeText(name), name);
        if (code) map.set(normalizeText(code), name);
    }
    return map;
};

export const resolveWarehouseDisplayName = (rawValue, labelMap) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (!labelMap?.size) return raw;
    return (
        labelMap.get(raw) ||
        labelMap.get(normalizeText(raw)) ||
        raw
    );
};

/** Tên kho hiển thị trên list (ưu tiên tên từ danh mục warehouses). */
export const getOrderWarehouseDisplayName = (order, labelMap) => {
    const raw = getOrderWarehouseLabel(order);
    if (!raw) return '';
    const resolved = resolveWarehouseDisplayName(raw, labelMap);
    return resolved || raw;
};

const getWarehouseAliases = (warehouse) => {
    const rawName = String(warehouse?.name || '').trim();
    const rawCode = String(warehouse?.code || '').trim();
    const rawId = String(warehouse?.id || '').trim();
    const shortFromName = rawName.includes('-') ? rawName.split('-')[0].trim() : '';
    const compactName = rawName.replace(/\s+/g, '');

    return [rawId, rawName, rawCode, shortFromName, compactName]
        .map(normalizeText)
        .filter(Boolean);
};

const getWarehouseKeyVariants = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return [];

    const shortByDash = normalized.includes('-') ? normalized.split('-')[0].trim() : '';
    const compact = normalized.replace(/\s+/g, '');
    const alnumOnly = normalized.replace(/[^a-z0-9]/g, '');

    return [...new Set([normalized, shortByDash, compact, alnumOnly].filter(Boolean))];
};

const getManagerCandidateKeys = (...values) => (
    [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
);

const warehouseManagedByUser = (warehouse, managerCandidates = []) => {
    const managerField = String(warehouse?.manager_name || '').trim();
    if (!managerField || managerCandidates.length === 0) return false;

    return managerField
        .split(/[,;/|]+/)
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .some((managerPart) =>
            managerCandidates.some((candidate) =>
                managerPart === candidate
                || managerPart.includes(candidate)
                || candidate.includes(managerPart)
            )
        );
};

const buildAllowedWarehouseKeys = (warehouses = []) => {
    const allowedWarehouseValues = new Set(warehouses.flatMap((warehouse) => getWarehouseAliases(warehouse)));
    return new Set(Array.from(allowedWarehouseValues).flatMap((key) => getWarehouseKeyVariants(key)));
};

/**
 * Quyền xem dữ liệu Kho & luân chuyển kho:
 * 1. Thủ kho: full dữ liệu các kho có manager_name = user (kho mình phụ trách)
 * 2. Kế toán: full tất cả kho
 * 3. Admin: full tất cả kho
 */
export const hasFullWarehouseListVisibility = (role) => hasFullDataVisibility(role);

export const canViewAllWarehouses = (role) => hasFullWarehouseListVisibility(role);

/**
 * Danh sách kho user được phép thao tác/xem chi tiết.
 * - Admin / Kế toán: tất cả kho
 * - Thủ kho: chỉ kho có manager_name khớp tên user (không fallback department)
 * - Nhân viên kho khác: fallback department/chi nhánh nếu không khớp manager
 */
export function filterWarehousesForCurrentUser(warehouses = [], { role, user, department } = {}) {
    if (hasFullWarehouseListVisibility(role)) {
        return warehouses || [];
    }

    const isThuKhoRole = isThuKhoRoleHelper(role);
    const isWarehouseRole = isWarehouseRoleHelper(role);

    if (!isThuKhoRole && !isWarehouseRole) {
        return warehouses || [];
    }

    const storageUserName =
        localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    const managerCandidates = getManagerCandidateKeys(user?.name, user?.username, storageUserName);

    let scoped = (warehouses || []).filter((warehouse) =>
        warehouseManagedByUser(warehouse, managerCandidates)
    );

    if (!isThuKhoRole && scoped.length === 0 && department) {
        const branchTokens = getManagerCandidateKeys(department, user?.chi_nhanh);
        if (branchTokens.length > 0) {
            scoped = (warehouses || []).filter((warehouse) => {
                const keys = getWarehouseAliases(warehouse);
                return branchTokens.some((token) =>
                    keys.some((key) => key.includes(token) || token.includes(key))
                );
            });
        }
    }

    return scoped;
}

/**
 * Phiếu điều chuyển / luân chuyển kho:
 * - Admin / Kế toán: tất cả phiếu
 * - Thủ kho: phiếu có kho xuất HOẶC kho nhận thuộc kho mình phụ trách (full luồng liên quan kho đó)
 */
export function filterTransfersForCurrentUser(transferRows = [], warehouses = [], { role, user, department } = {}) {
    if (hasFullWarehouseListVisibility(role)) {
        return transferRows || [];
    }

    const isThuKhoRole = isThuKhoRoleHelper(role);
    const isWarehouseRole = isWarehouseRoleHelper(role);

    if (!isThuKhoRole && !isWarehouseRole) {
        return transferRows || [];
    }

    const allowedWarehouses = filterWarehousesForCurrentUser(warehouses, { role, user, department });
    const allowedIds = new Set(allowedWarehouses.map((w) => w.id).filter(Boolean));

    if (allowedIds.size === 0) return [];

    return (transferRows || []).filter(
        (row) =>
            allowedIds.has(row.from_warehouse_id) || allowedIds.has(row.to_warehouse_id)
    );
}

export async function loadCustomerWarehouseMap(orders = []) {
    const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
    if (customerIds.length === 0) return {};

    const customerWarehouseById = {};
    for (let i = 0; i < customerIds.length; i += 200) {
        const ids = customerIds.slice(i, i + 200);
        const { data, error } = await supabase
            .from('customers')
            .select('id, warehouse_id')
            .in('id', ids);
        if (error) {
            console.error('Error loading customer warehouses:', error);
            continue;
        }
        (data || []).forEach((row) => {
            customerWarehouseById[row.id] = row.warehouse_id;
        });
    }
    return customerWarehouseById;
}

const orderMatchesWarehouseScope = (
    order,
    customerWarehouseById,
    allowedKeys,
    { customerWarehouseOnly = false, orderWarehouseOnly = false } = {},
) => {
    const customerWarehouse = customerWarehouseById[order.customer_id];
    let sources;
    if (orderWarehouseOnly) {
        sources = [order.warehouse, extractWarehouseFromNote(order.note)];
    } else if (customerWarehouseOnly) {
        sources = [customerWarehouse];
    } else {
        sources = [customerWarehouse, order.warehouse, extractWarehouseFromNote(order.note)];
    }
    const candidates = sources.flatMap((candidate) => getWarehouseKeyVariants(candidate));
    return candidates.some((candidateKey) => allowedKeys.has(candidateKey));
};

/**
 * @param {object} options
 * @param {boolean} [options.matchOrderWarehouseFields] — ĐNXM/thủ kho: lọc theo cột Kho trên phiếu (order.warehouse, note), không chỉ kho KH
 */
export async function scopeOrdersForWarehouseAccess(
    orders = [],
    { role, department, user, isAdmin = false, matchOrderWarehouseFields = false } = {},
) {
    const normalizedRole = normalizeRole(role);
    const isThuKhoRole = isThuKhoRoleHelper(role);
    const isWarehouseRole = isWarehouseRoleHelper(role);
    const storageUserName =
        localStorage.getItem('user_name')
        || sessionStorage.getItem('user_name')
        || '';

    let scopedOrders = orders || [];
    const customerWarehouseById = await loadCustomerWarehouseMap(scopedOrders);

    if (!hasFullDataVisibility(role) && !isAdmin && (isThuKhoRole || isWarehouseRole)) {
        const managerCandidates = getManagerCandidateKeys(user?.name, user?.username, storageUserName);

        const { data: warehousesData } = await supabase
            .from('warehouses')
            .select('id, name, code, manager_name');

        let scopedWarehouses = (warehousesData || []).filter((warehouse) =>
            warehouseManagedByUser(warehouse, managerCandidates)
        );

        if (!isThuKhoRole && scopedWarehouses.length === 0) {
            const branchTokens = getManagerCandidateKeys(department, user?.chi_nhanh);
            if (branchTokens.length > 0) {
                scopedWarehouses = (warehousesData || []).filter((warehouse) => {
                    const keys = getWarehouseAliases(warehouse);
                    return branchTokens.some((token) =>
                        keys.some((key) => key.includes(token) || token.includes(key))
                    );
                });
            }
        }

        if (scopedWarehouses.length > 0) {
            const allowedKeys = buildAllowedWarehouseKeys(scopedWarehouses);
            // TK kho / thủ kho: khớp cột Kho trên phiếu (warehouse + note), không chỉ kho KH
            const matchWarehouseColumn =
                matchOrderWarehouseFields || isThuKhoRole || isWarehouseRole;
            const scopeMatchOptions = matchWarehouseColumn
                ? { orderWarehouseOnly: true }
                : { customerWarehouseOnly: isThuKhoRole };

            scopedOrders = scopedOrders.filter((order) =>
                orderMatchesWarehouseScope(order, customerWarehouseById, allowedKeys, scopeMatchOptions),
            );
        } else if (!isThuKhoRole && department) {
            const fallbackWarehouseCode = department.includes('-')
                ? department.split('-')[0].trim()
                : department.trim();
            const fallbackKeys = new Set(getWarehouseKeyVariants(fallbackWarehouseCode));
            scopedOrders = scopedOrders.filter((order) =>
                orderMatchesWarehouseScope(order, customerWarehouseById, fallbackKeys, {
                    orderWarehouseOnly: isWarehouseRole,
                    customerWarehouseOnly: false,
                })
            );
        } else {
            scopedOrders = [];
        }
    }

    return { orders: scopedOrders, customerWarehouseById };
}
