import { supabase } from '../supabase/config';
import { hasFullDataVisibility } from './accessControl';
import {
    filterWarehousesForCurrentUser,
    hasFullWarehouseListVisibility,
} from './orderWarehouseScope';

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const getUserCandidateKeys = (user) => {
    const storageName =
        localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    return [...new Set([user?.name, user?.username, storageName].map(normalizeText).filter(Boolean))];
};

const warehouseKeyMatches = (warehouseId, allowedCodes, allowedIds) => {
    const key = String(warehouseId || '').trim();
    if (!key) return false;
    return allowedCodes.includes(key) || allowedIds.includes(key);
};

export async function getSupplierVisibilityScope({ role, user, department } = {}) {
    if (hasFullWarehouseListVisibility(role)) {
        return {
            fullAccess: true,
            allowedCodes: [],
            allowedIds: [],
            allowedWarehouses: [],
        };
    }

    const { data: warehouseRows, error } = await supabase
        .from('warehouses')
        .select('id, code, name, manager_name, branch_office')
        .eq('status', 'Đang hoạt động');

    if (error) {
        console.error('getSupplierVisibilityScope warehouses:', error);
        return {
            fullAccess: false,
            allowedCodes: [],
            allowedIds: [],
            allowedWarehouses: [],
        };
    }

    const allowedWarehouses = filterWarehousesForCurrentUser(warehouseRows || [], {
        role,
        user,
        department,
    });

    const allowedCodes = [
        ...new Set(allowedWarehouses.map((w) => String(w.code || '').trim()).filter(Boolean)),
    ];
    const allowedIds = [
        ...new Set(allowedWarehouses.map((w) => String(w.id || '').trim()).filter(Boolean)),
    ];

    return {
        fullAccess: false,
        allowedCodes,
        allowedIds,
        allowedWarehouses,
    };
}

export function filterGoodsReceiptsForSupplierScope(receipts = [], scope) {
    if (scope?.fullAccess) return receipts || [];
    const { allowedCodes = [], allowedIds = [] } = scope || {};
    if (!allowedCodes.length && !allowedIds.length) return [];
    return (receipts || []).filter((row) =>
        warehouseKeyMatches(row.warehouse_id, allowedCodes, allowedIds),
    );
}

export function filterGoodsIssuesForSupplierScope(issues = [], scope) {
    if (scope?.fullAccess) return issues || [];
    const { allowedCodes = [], allowedIds = [] } = scope || {};
    if (!allowedCodes.length && !allowedIds.length) return [];
    return (issues || []).filter((row) =>
        warehouseKeyMatches(row.warehouse_id, allowedCodes, allowedIds),
    );
}

/** Thủ kho: chỉ giao dịch thu/chi do mình lập (created_by) */
export function filterSupplierTransactionsByCreator(transactions = [], { role, user } = {}) {
    if (hasFullDataVisibility(role)) return transactions || [];

    const candidates = getUserCandidateKeys(user);
    if (!candidates.length) return [];

    return (transactions || []).filter((tx) => {
        const creator = normalizeText(tx.created_by);
        return candidates.some(
            (c) => creator === c || creator.includes(c) || c.includes(creator),
        );
    });
}

export function collectSupplierNamesFromScopedRows(receipts = [], issues = [], suppliersById = {}) {
    const names = new Set();
    (receipts || []).forEach((row) => {
        const name = String(row.supplier_name || '').trim();
        if (name) names.add(name);
    });
    (issues || []).forEach((row) => {
        const supplier = suppliersById[row.supplier_id];
        const name = String(supplier?.name || '').trim();
        if (name) names.add(name);
    });
    return [...names];
}

export async function filterSuppliersListForUser(suppliers = [], context) {
    const scope = await getSupplierVisibilityScope(context);
    if (scope.fullAccess) return suppliers || [];

    if (!scope.allowedCodes.length && !scope.allowedIds.length) {
        return [];
    }

    const [receiptsRes, issuesRes] = await Promise.all([
        supabase.from('goods_receipts').select('supplier_name, warehouse_id'),
        supabase.from('goods_issues').select('supplier_id, warehouse_id'),
    ]);

    const scopedReceipts = filterGoodsReceiptsForSupplierScope(receiptsRes.data || [], scope);
    const scopedIssues = filterGoodsIssuesForSupplierScope(issuesRes.data || [], scope);

    const suppliersById = Object.fromEntries((suppliers || []).map((s) => [s.id, s]));
    const visibleNames = new Set(
        collectSupplierNamesFromScopedRows(scopedReceipts, scopedIssues, suppliersById).map(normalizeText),
    );

    return (suppliers || []).filter((supplier) => {
        const nameKey = normalizeText(supplier.name);
        return visibleNames.has(nameKey);
    });
}
