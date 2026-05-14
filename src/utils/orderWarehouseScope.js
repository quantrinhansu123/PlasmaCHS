import { supabase } from '../supabase/config';
import { isWarehouseRole as isWarehouseRoleHelper, normalizeRole } from './accessControl';

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const extractWarehouseFromNote = (note) => {
    const text = String(note || '');
    if (!text) return '';
    const match = text.match(/Kho:\s*([^\n\r.]+)/i);
    return (match?.[1] || '').trim();
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

const orderMatchesWarehouseScope = (order, customerWarehouseById, allowedKeys, { customerWarehouseOnly = false } = {}) => {
    const customerWarehouse = customerWarehouseById[order.customer_id];
    const sources = customerWarehouseOnly
        ? [customerWarehouse]
        : [customerWarehouse, order.warehouse, extractWarehouseFromNote(order.note)];
    const candidates = sources.flatMap((candidate) => getWarehouseKeyVariants(candidate));
    return candidates.some((candidateKey) => allowedKeys.has(candidateKey));
};

export async function scopeOrdersForWarehouseAccess(orders = [], { role, department, user, isAdmin = false } = {}) {
    const normalizedRole = normalizeRole(role);
    const isThuKhoRole = normalizedRole.includes('thukho');
    const isWarehouseRole = isWarehouseRoleHelper(role);
    const storageUserName =
        localStorage.getItem('user_name')
        || sessionStorage.getItem('user_name')
        || '';

    let scopedOrders = orders || [];
    const customerWarehouseById = await loadCustomerWarehouseMap(scopedOrders);

    if (!isAdmin && (isThuKhoRole || isWarehouseRole)) {
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
            scopedOrders = scopedOrders.filter((order) =>
                orderMatchesWarehouseScope(order, customerWarehouseById, allowedKeys, {
                    customerWarehouseOnly: isThuKhoRole,
                })
            );
        } else if (!isThuKhoRole && department) {
            const fallbackWarehouseCode = department.includes('-')
                ? department.split('-')[0].trim()
                : department.trim();
            const fallbackKeys = new Set(getWarehouseKeyVariants(fallbackWarehouseCode));
            scopedOrders = scopedOrders.filter((order) =>
                orderMatchesWarehouseScope(order, customerWarehouseById, fallbackKeys, {
                    customerWarehouseOnly: false,
                })
            );
        } else {
            scopedOrders = [];
        }
    }

    return { orders: scopedOrders, customerWarehouseById };
}
