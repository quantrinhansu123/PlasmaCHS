import { supabase } from '../supabase/config';
import {
    hasFullDataVisibility,
    isThuKhoRole as isThuKhoRoleHelper,
    isWarehouseRole as isWarehouseRoleHelper,
    normalizeRole,
} from './accessControl';
import { buildWarehouseModalAliases, resolveWarehouseRow, storedValueMatchesWarehouse } from './transferWarehouseMatch';
import { getCylinderKhoValue, buildCylinderKhoScopeKeys } from './cylinderKho';
export {
    CYLINDER_KHO_COLUMN,
    buildCylinderKhoScopeKeys,
    cylinderKhoMatchesWarehouseRecord,
    getCylinderKhoValue,
    isMissingKhoColumnError,
} from './cylinderKho';

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
            managerCandidates.some((candidate) => {
                const compactManager = compactLoginKey(managerPart);
                const compactCandidate = compactLoginKey(candidate);
                return (
                    managerPart === candidate
                    || compactManager === compactCandidate
                    || managerPart.includes(candidate)
                    || candidate.includes(managerPart)
                );
            }),
        );
};

const compactLoginKey = (value) =>
    normalizeText(value).replace(/[^a-z0-9]/g, '');

/** Chuẩn hóa biến thể nick/mã OCP (OCCP1, OCP1, ocp-1…). */
const normalizeOcpWarehouseKey = (value) =>
    compactLoginKey(value).replace(/^occ+(?=p)/, 'oc');

/** Suy mã kho từ nick đăng nhập khi bảng warehouses trống / chưa đồng bộ (vd. NVK-OCP1 → OCP1). */
export function deriveManagingWarehouseCodesFromUser({ user, department } = {}) {
    const storageUserName =
        localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    const storageLogin =
        localStorage.getItem('user_login')
        || sessionStorage.getItem('user_login')
        || storageUserName;

    const loginCandidates = getManagerCandidateKeys(
        user?.username,
        user?.name,
        storageUserName,
        storageLogin,
    );

    const codes = new Set();

    for (const candidate of loginCandidates) {
        const nvkMatch = candidate.match(/^nvk[-_](.+)$/i);
        if (nvkMatch?.[1]) {
            const code = normalizeOcpWarehouseKey(nvkMatch[1]);
            if (code) codes.add(code);
        }
    }

    if (codes.size === 0 && department) {
        getManagerCandidateKeys(department, user?.chi_nhanh).forEach((token) => {
            const code = normalizeOcpWarehouseKey(token);
            if (code && /^ocp\d*$/i.test(code)) codes.add(code);
            if (/^(hn|dn|ct|th|nm|nmk|vq|vpmn)$/i.test(code)) codes.add(code);
            if (token.includes('-')) {
                const tail = normalizeOcpWarehouseKey(token.split('-').pop());
                if (tail && /^ocp\d*$/i.test(tail)) codes.add(tail);
            }
        });
    }

    return [...codes];
};

const buildSyntheticWarehousesFromCodes = (codes = []) =>
    codes.map((code) => ({
        id: String(code),
        code: String(code).toUpperCase(),
        name: String(code).toUpperCase(),
        manager_name: '',
    }));

/** Khớp mã/tên kho với nick đăng nhập (vd. NVK-OCP1 ↔ OCP1, OCCP1 ↔ OCP1). */
const warehouseMatchesLoginIdentity = (warehouse, loginCandidates = []) => {
    const warehouseKeys = [warehouse?.code, warehouse?.name]
        .map((value) => normalizeOcpWarehouseKey(value))
        .filter(Boolean);
    if (!warehouseKeys.length || !loginCandidates.length) return false;

    return loginCandidates.some((candidate) => {
        const loginKey = normalizeOcpWarehouseKey(candidate);
        if (!loginKey) return false;
        return warehouseKeys.some((warehouseKey) => {
            if (loginKey === warehouseKey) return true;
            if (loginKey.length >= 3 && warehouseKey.includes(loginKey)) return true;
            if (warehouseKey.length >= 3 && loginKey.includes(warehouseKey)) return true;
            return false;
        });
    });
};

/** Các giá trị có thể lưu ở machines.warehouse / cylinders.warehouse. */
export function getWarehouseStorageFilterKeys(warehouse) {
    if (!warehouse) return [];
    const raw = [
        warehouse.id,
        warehouse.code,
        warehouse.name,
        warehouse.branch_office,
    ].map((v) => String(v || '').trim()).filter(Boolean);
    return [...new Set([
        ...raw,
        ...raw.flatMap((key) => getWarehouseKeyVariants(key)),
    ])];
}

/** Mọi khóa dùng lọc DB: UUID, mã, tên, alias vùng (OCP1, HN…). */
export function getFullWarehouseFilterKeys(warehouse) {
    if (!warehouse) return [];
    return [...new Set([
        ...getWarehouseStorageFilterKeys(warehouse),
        ...buildWarehouseModalAliases(warehouse),
    ])].filter(Boolean);
}

export function buildScopedWarehouseFilterKeys(warehouses = []) {
    return [...new Set((warehouses || []).flatMap(getFullWarehouseFilterKeys))];
}

/** Chỉ tên kho — khớp cột Kho Quản Lý trên /binh (NVK). */
export function getManagingWarehouseNameKey(warehouse) {
    return String(warehouse?.name || '').trim();
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWarehouseUuidLike(value) {
    return UUID_LIKE.test(String(value || '').trim());
}

/**
 * Giá trị lưu cột inventory.warehouse_id — luôn là tên kho, không UUID/mã.
 */
export function resolveInventoryWarehouseName(whRow, warehouseRef = '', warehouseList = []) {
    const row = whRow || resolveWarehouseRow(warehouseRef, warehouseList);
    const name = getManagingWarehouseNameKey(row);
    if (name) return name;
    const ref = String(warehouseRef || '').trim();
    if (ref && !isWarehouseUuidLike(ref)) return ref;
    return '';
}

/** Khóa tra cứu inventory — ưu tiên tên kho; vẫn đọc legacy mã/tên cũ. */
export function buildInventoryWarehouseLookupKeys(whRow, warehouseRef = '', warehouseList = []) {
    const row = whRow || resolveWarehouseRow(warehouseRef, warehouseList);
    const keys = new Set();
    const name = resolveInventoryWarehouseName(row, warehouseRef, warehouseList);
    if (name) keys.add(name);
    const code = String(row?.code || '').trim();
    if (code && code !== name) keys.add(code);
    const ref = String(warehouseRef || '').trim();
    if (ref && !isWarehouseUuidLike(ref) && ref !== name) keys.add(ref);
    return [...keys];
}

export function buildManagingWarehouseNameKeys(warehouses = []) {
    return [...new Set(
        (warehouses || []).map(getManagingWarehouseNameKey).filter(Boolean),
    )];
}

export function rowMatchesManagingWarehouseName(storedValue, warehouse) {
    const stored = String(storedValue || '').trim();
    const name = getManagingWarehouseNameKey(warehouse);
    if (!stored || !name) return false;
    return stored.toLowerCase() === name.toLowerCase();
}

export function resolveCylinderWarehouseValue(warehouseRef, warehouses = []) {
    const ref = String(warehouseRef || '').trim();
    if (!ref) return '';
    const records = resolveWarehouseRecordsFromSelection([ref], warehouses);
    if (records.length) return resolveWarehouseStorageName(records[0]);
    return ref;
}

/** Dropdown chọn kho → danh sách tên kho để lọc warehouse_id. */
export function resolveManagingWarehouseNamesFromSelection(selectedIds = [], warehouses = []) {
    const names = new Set();
    (selectedIds || []).forEach((sel) => {
        const selStr = String(sel || '').trim();
        if (!selStr) return;
        const wh = (warehouses || []).find(
            (w) =>
                String(w.id) === selStr
                || String(w.code || '').trim() === selStr
                || String(w.name || '').trim() === selStr,
        );
        const name = getManagingWarehouseNameKey(wh);
        if (name) names.add(name);
    });
    return [...names];
}

/** Khóa lọc theo tên/mã kho (Kho phụ trách KH lưu «OCP1», không phải UUID). */
export function getWarehouseNameFilterKeys(warehouse) {
    if (!warehouse) return [];
    const keys = new Set();
    [warehouse?.code, warehouse?.name, warehouse?.branch_office].forEach((value) => {
        const raw = String(value || '').trim();
        if (raw) keys.add(raw);
    });
    buildWarehouseModalAliases(warehouse).forEach((alias) => {
        const raw = String(alias || '').trim();
        if (raw) keys.add(raw);
    });
    return [...keys];
}

/** Mã/tên/alias — mọi giá trị có thể còn trong cylinders.warehouse. */
export function buildCylinderWarehouseQueryKeys(warehouses = []) {
    const keys = new Set();
    (warehouses || []).forEach((warehouse) => {
        getCylinderWarehouseFilterKeys(warehouse).forEach((key) => keys.add(key));
        const legacyId = String(warehouse?.id || '').trim();
        if (legacyId) keys.add(legacyId);
    });
    return [...keys];
}

/** @deprecated dùng buildCylinderWarehouseQueryKeys */
export function buildCylinderWarehouseUuidQueryKeys(warehouses = []) {
    return buildCylinderWarehouseQueryKeys(warehouses);
}

/** Lấy tên kho để query DB (đồng bộ, không cần UUID). */
export function resolveWarehouseUuidKeysForQuery(warehouse, _supabaseClient) {
    return Promise.resolve(buildCylinderWarehouseQueryKeys(warehouse ? [warehouse] : []));
}

export function buildCylinderWarehouseNameScopeKeys(warehouses = []) {
    const keys = new Set();
    (warehouses || []).forEach((warehouse) => {
        getWarehouseNameFilterKeys(warehouse).forEach((key) => keys.add(key));
    });
    return [...keys];
}

/**
 * Khóa tra cứu DB cylinders.warehouse — mã/tên kho.
 */
export function buildCylinderWarehouseReadKeys(warehouses = []) {
    return buildCylinderWarehouseQueryKeys(warehouses);
}

/** Khớp giá trị cột kho (tên/mã) — không so UUID id. Dùng cho customers.warehouse_id (Kho phụ trách). */
export function rowMatchesWarehouseNameStorage(storedValue, warehouse, warehouseList = []) {
    const stored = String(storedValue || '').trim();
    if (!stored || !warehouse) return false;

    const storedLower = stored.toLowerCase();
    if (getWarehouseNameFilterKeys(warehouse).some(
        (key) => String(key).trim().toLowerCase() === storedLower,
    )) {
        return true;
    }

    return (
        storedValueMatchesWarehouse(stored, warehouse.code, warehouseList)
        || storedValueMatchesWarehouse(stored, warehouse.name, warehouseList)
    );
}

/** Giá trị lưu cylinders.kho / machines.warehouse — ưu tiên tên kho. */
export function resolveWarehouseStorageName(warehouse) {
    return String(warehouse?.name || warehouse?.code || '').trim();
}

/** Tên hiển thị danh sách kho — ưu tiên name, fallback code/chi nhánh. */
export function getWarehouseDisplayName(warehouse) {
    const name = String(warehouse?.name || '').trim();
    if (name) return name;
    const code = String(warehouse?.code || '').trim();
    if (code) return code;
    const branch = String(warehouse?.branch_office || '').trim();
    if (branch) return branch;
    return '—';
}

/** Chuẩn hoá giá trị đã lưu (tên hoặc UUID cũ) → tên kho. */
export function resolveStoredWarehouseName(storedValue, warehouses = []) {
    const stored = String(storedValue || '').trim();
    if (!stored) return '';
    const byId = (warehouses || []).find((w) => String(w.id || '').trim() === stored);
    if (byId?.name) return String(byId.name).trim();
    return stored;
}

/** Khóa lọc cylinders.warehouse — mã/tên kho. */
export function getCylinderWarehouseFilterKeys(warehouse) {
    if (!warehouse) return [];
    const keys = new Set();
    const storage = resolveWarehouseStorageName(warehouse);
    if (storage) keys.add(storage);
    getWarehouseNameFilterKeys(warehouse).forEach((key) => keys.add(key));
    const legacyId = String(warehouse?.id || '').trim();
    if (legacyId) keys.add(legacyId);
    return [...keys].filter(Boolean);
}

export function rowMatchesCylinderWarehouseStorage(storedValue, warehouse, warehouses = []) {
    const stored = String(storedValue || '').trim();
    if (!stored || !warehouse) return false;

    const storedLower = stored.toLowerCase();
    if (buildCylinderKhoScopeKeys([warehouse]).some(
        (key) => key.toLowerCase() === storedLower,
    )) {
        return true;
    }

    const resolved = resolveStoredWarehouseName(stored, warehouses);
    if (!resolved) return false;
    const resolvedLower = resolved.toLowerCase();
    return buildCylinderKhoScopeKeys([warehouse]).some(
        (key) => key.toLowerCase() === resolvedLower,
    );
}

/** Khớp bình với danh sách kho đã chọn (theo tên kho). */
export function cylinderMatchesManagingWarehouseFilter(cylinder, targetWarehouses = [], warehouses = []) {
    if (!targetWarehouses?.length) return true;
    const stored = getCylinderKhoValue(cylinder);
    if (!stored) return false;
    return targetWarehouses.some((wh) =>
        rowMatchesCylinderWarehouseStorage(stored, wh, warehouses),
    );
}

/** @deprecated dùng cylinderMatchesManagingWarehouseFilter */
export function cylinderMatchesManagingWarehouseNames(cylinder, targetNames = [], warehouses = []) {
    if (!targetNames?.length) return true;
    const records = (warehouses || []).filter((wh) =>
        targetNames.some((name) => String(wh?.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()),
    );
    if (!records.length) {
        return cylinderMatchesManagingWarehouseFilter(
            cylinder,
            targetNames.map((name) => ({ id: '', name })),
        );
    }
    return cylinderMatchesManagingWarehouseFilter(cylinder, records);
}

/** Hiển thị Kho Quản Lý — chuẩn theo tên kho. */
export function getCylinderManagingWarehouseDisplayName(cylinder, warehouses = []) {
    if (cylinder?.warehouses?.name) return cylinder.warehouses.name;
    const stored = resolveStoredWarehouseName(getCylinderKhoValue(cylinder), warehouses);
    if (!stored) return '—';
    const matched = (warehouses || []).find((wh) =>
        rowMatchesCylinderWarehouseStorage(stored, wh, warehouses),
    );
    return matched?.name || stored;
}

/** Khóa lọc cylinders.kho — mã/tên kho từ danh mục Kho (manager_name trên warehouses). */
export function buildCylinderWarehouseScopeKeys(warehouses = []) {
    return buildCylinderKhoScopeKeys(warehouses);
}

/** Dropdown chọn kho trên /binh → mã/tên cho cột cylinders.kho. */
export function expandCylinderWarehouseSelectionKeys(selectedIds = [], warehouses = []) {
    const records = resolveWarehouseRecordsFromSelection(selectedIds, warehouses);
    if (records.length) return buildCylinderKhoScopeKeys(records);

    return (selectedIds || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

/** Kiểm tra giá trị cột kho trên bản ghi có thuộc một kho trong danh mục. */
export function rowMatchesWarehouseStorage(storedValue, warehouse, warehouseList = []) {
    const stored = String(storedValue || '').trim();
    if (!stored || !warehouse) return false;

    const storedLower = stored.toLowerCase();
    if (getFullWarehouseFilterKeys(warehouse).some(
        (key) => String(key).trim().toLowerCase() === storedLower,
    )) {
        return true;
    }

    return (
        storedValueMatchesWarehouse(stored, warehouse.id, warehouseList)
        || storedValueMatchesWarehouse(stored, warehouse.code, warehouseList)
        || storedValueMatchesWarehouse(stored, warehouse.name, warehouseList)
    );
}

/** Khách hàng có Kho phụ trách khớp tên/mã kho (customers.warehouse_id thường là «OCP1», không phải UUID). */
export function getCustomerIdsForManagingWarehouses(customers = [], targetWarehouses = [], warehouseList = []) {
    const ids = new Set();
    (customers || []).forEach((customer) => {
        if (!customer?.id) return;
        const matches = (targetWarehouses || []).some((warehouse) =>
            rowMatchesWarehouseNameStorage(customer.warehouse_id, warehouse, warehouseList),
        );
        if (matches) ids.add(String(customer.id));
    });
    return [...ids];
}

/** Nhãn customer_name trên bình — KH có Kho phụ trách khớp tên kho. */
export function getCustomerMatchLabelsForManagingWarehouses(customers = [], targetWarehouses = [], warehouseList = []) {
    const labels = new Set();
    (customers || []).forEach((customer) => {
        const matches = (targetWarehouses || []).some((warehouse) =>
            rowMatchesWarehouseNameStorage(customer.warehouse_id, warehouse, warehouseList),
        );
        if (!matches) return;
        [customer.name, customer.legal_rep, customer.invoice_company_name].forEach((field) => {
            const label = String(field || '').trim();
            if (label) labels.add(label);
        });
    });
    return [...labels];
}

export function resolveWarehouseRecordsFromSelection(selectedIds = [], warehouses = []) {
    return (selectedIds || [])
        .map((selected) => {
            const selStr = String(selected || '').trim();
            if (!selStr) return null;
            return (warehouses || []).find(
                (warehouse) =>
                    String(warehouse.id) === selStr
                    || String(warehouse.code || '').trim() === selStr
                    || String(warehouse.name || '').trim() === selStr,
            ) || null;
        })
        .filter(Boolean);
}

const quotePostgrestFilterValue = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/[,()"\\\s]/.test(raw)) {
        return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return raw;
};

const buildPostgrestInClause = (values = []) => {
    const quoted = (values || []).map(quotePostgrestFilterValue).filter(Boolean);
    if (!quoted.length) return '';
    return `(${quoted.join(',')})`;
};

/**
 * Lọc theo kho quản lý trực tiếp HOẶC kho phụ trách (customer_id / customer_name).
 * Bình/máy đang ở khách vẫn hiện nếu KH thuộc kho phụ trách của Thủ kho.
 */
export function applyManagingWarehouseOrFilter(
    query,
    {
        warehouseColumn,
        warehouseKeys = [],
        secondaryColumn,
        secondaryValues = [],
        tertiaryColumn,
        tertiaryValues = [],
        noAccessValue,
    } = {},
) {
    const keys = [...new Set((warehouseKeys || []).map((value) => String(value).trim()).filter(Boolean))];
    const secondary = [...new Set((secondaryValues || []).map((value) => String(value).trim()).filter(Boolean))];
    const tertiary = [...new Set((tertiaryValues || []).map((value) => String(value).trim()).filter(Boolean))];

    if (!keys.length && !secondary.length && !tertiary.length) {
        return query.eq(warehouseColumn, noAccessValue);
    }

    if (keys.length && !secondary.length && !tertiary.length) {
        return query.in(warehouseColumn, keys);
    }
    if (!keys.length && secondary.length && !tertiary.length) {
        return query.in(secondaryColumn, secondary);
    }
    if (!keys.length && !secondary.length && tertiary.length) {
        return query.in(tertiaryColumn, tertiary);
    }

    const parts = [];
    if (keys.length) parts.push(`${warehouseColumn}.in.${buildPostgrestInClause(keys)}`);
    if (secondary.length) parts.push(`${secondaryColumn}.in.${buildPostgrestInClause(secondary)}`);
    if (tertiary.length) parts.push(`${tertiaryColumn}.in.${buildPostgrestInClause(tertiary)}`);

    return query.or(parts.join(','));
}

/** Khớp kho quản lý: cột kho trên bản ghi hoặc kho phụ trách KH. */
export function rowMatchesManagingWarehouseRecord(record, warehouse, warehouseList, options = {}) {
    const warehouseValue = options.warehouseValue ?? getCylinderKhoValue(record);
    if (rowMatchesWarehouseStorage(warehouseValue, warehouse, warehouseList)) {
        return true;
    }
    const customerWarehouseValue = options.customerWarehouseValue;
    if (customerWarehouseValue !== undefined && customerWarehouseValue !== null && customerWarehouseValue !== '') {
        if (options.matchCustomerWarehouseByName) {
            return rowMatchesWarehouseNameStorage(customerWarehouseValue, warehouse, warehouseList);
        }
        return rowMatchesWarehouseStorage(customerWarehouseValue, warehouse, warehouseList);
    }
    return false;
}

/** Mở rộng lựa chọn dropdown (id kho) → mọi biến thể lưu DB (UUID, OCP1, tên…). */
export function expandWarehouseSelectionKeys(selectedIds = [], warehouses = []) {
    if (!selectedIds?.length) return [];
    const keys = new Set();
    selectedIds.forEach((sel) => {
        const selStr = String(sel || '').trim();
        if (!selStr) return;
        const wh = (warehouses || []).find(
            (w) =>
                String(w.id) === selStr
                || String(w.code || '').trim() === selStr
                || String(w.name || '').trim() === selStr,
        );
        if (wh) {
            getFullWarehouseFilterKeys(wh).forEach((k) => keys.add(String(k).trim()));
        } else {
            keys.add(selStr);
        }
    });
    return [...keys].filter(Boolean);
}

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
    const storageLogin =
        localStorage.getItem('user_login')
        || sessionStorage.getItem('user_login')
        || storageUserName;
    const managerCandidates = getManagerCandidateKeys(
        user?.name,
        user?.username,
        storageUserName,
        storageLogin,
    );

    let scoped = (warehouses || []).filter((warehouse) =>
        warehouseManagedByUser(warehouse, managerCandidates)
    );

    if (isThuKhoRole && scoped.length === 0) {
        const loginCandidates = getManagerCandidateKeys(
            user?.username,
            user?.name,
            storageUserName,
            storageLogin,
        );
        scoped = (warehouses || []).filter((warehouse) =>
            warehouseMatchesLoginIdentity(warehouse, loginCandidates),
        );
    }

    if (isThuKhoRole && scoped.length === 0 && department) {
        const deptTokens = getManagerCandidateKeys(department, user?.chi_nhanh);
        if (deptTokens.length > 0) {
            scoped = (warehouses || []).filter((warehouse) => {
                const keys = getWarehouseAliases(warehouse);
                return deptTokens.some((token) =>
                    keys.some((key) => key === token || (token.length >= 3 && key.includes(token))),
                );
            });
            const exactCode = scoped.filter((warehouse) =>
                deptTokens.some((token) => normalizeOcpWarehouseKey(warehouse?.code) === normalizeOcpWarehouseKey(token)),
            );
            if (exactCode.length > 0) scoped = exactCode;
        }
    }

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

    if ((isThuKhoRole || isWarehouseRole) && scoped.length === 0) {
        const derivedCodes = deriveManagingWarehouseCodesFromUser({ user, department });
        if (derivedCodes.length > 0) {
            return buildSyntheticWarehousesFromCodes(derivedCodes);
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
    const allowedKeys = new Set();
    allowedWarehouses.forEach((w) => {
        [w.id, w.code, w.name].forEach((v) => {
            const key = String(v || '').trim();
            if (key) allowedKeys.add(key);
        });
    });

    if (allowedKeys.size === 0) return [];

    return (transferRows || []).filter(
        (row) =>
            allowedKeys.has(String(row.from_warehouse_id || '').trim())
            || allowedKeys.has(String(row.to_warehouse_id || '').trim()),
    );
}

export async function loadCustomerWarehouseMap(orders = []) {
    const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
    const customerNames = [...new Set(
        orders
            .filter((order) => !order.customer_id && order.customer_name)
            .map((order) => String(order.customer_name).trim())
            .filter(Boolean),
    )];

    if (customerIds.length === 0 && customerNames.length === 0) return {};

    const customerWarehouseById = {};

    for (let i = 0; i < customerIds.length; i += 200) {
        const ids = customerIds.slice(i, i + 200);
        const { data, error } = await supabase
            .from('customers')
            .select('id, warehouse_id, name')
            .in('id', ids);
        if (error) {
            console.error('Error loading customer warehouses:', error);
            continue;
        }
        (data || []).forEach((row) => {
            customerWarehouseById[row.id] = row.warehouse_id;
            if (row.name) customerWarehouseById[row.name] = row.warehouse_id;
        });
    }

    for (let i = 0; i < customerNames.length; i += 100) {
        const names = customerNames.slice(i, i + 100);
        const { data, error } = await supabase
            .from('customers')
            .select('name, warehouse_id')
            .in('name', names);
        if (error) {
            console.error('Error loading customer warehouses by name:', error);
            continue;
        }
        (data || []).forEach((row) => {
            if (row.name) customerWarehouseById[row.name] = row.warehouse_id;
        });
    }

    return customerWarehouseById;
}

const orderMatchesWarehouseScope = (
    order,
    customerWarehouseById,
    scopedWarehouses,
    warehouseList = scopedWarehouses,
    { customerWarehouseOnly = false } = {},
) => {
    const customerWarehouse =
        customerWarehouseById[order.customer_id]
        ?? customerWarehouseById[order.customer_name];

    if (customerWarehouseOnly) {
        return (scopedWarehouses || []).some((warehouse) =>
            rowMatchesWarehouseNameStorage(customerWarehouse, warehouse, warehouseList),
        );
    }

    return (scopedWarehouses || []).some((warehouse) =>
        rowMatchesManagingWarehouseRecord(order, warehouse, warehouseList, {
            warehouseValue: order?.warehouse || extractWarehouseFromNote(order?.note),
            customerWarehouseValue: customerWarehouse,
            matchCustomerWarehouseByName: true,
        }),
    );
};

/**
 * @param {object} options
 * @param {boolean} [options.matchOrderWarehouseFields] — ĐNXM/thủ kho: lọc theo cột Kho trên phiếu (order.warehouse, note), không chỉ kho KH
 */
export async function scopeOrdersForWarehouseAccess(
    orders = [],
    { role, department, user, isAdmin = false, matchOrderWarehouseFields = false } = {},
) {
    if (hasFullDataVisibility(role, department) || isAdmin) {
        const customerWarehouseById = await loadCustomerWarehouseMap(orders || []);
        return { orders: orders || [], customerWarehouseById };
    }

    const isThuKhoRole = isThuKhoRoleHelper(role);
    const isWarehouseRole = isWarehouseRoleHelper(role);

    let scopedOrders = orders || [];
    const customerWarehouseById = await loadCustomerWarehouseMap(scopedOrders);

    if (isThuKhoRole || isWarehouseRole) {
        const { data: warehousesData } = await supabase
            .from('warehouses')
            .select('id, name, code, manager_name, branch_office');

        const scopedWarehouses = filterWarehousesForCurrentUser(warehousesData || [], {
            role,
            user,
            department,
        });

        if (scopedWarehouses.length > 0) {
            scopedOrders = scopedOrders.filter((order) =>
                orderMatchesWarehouseScope(
                    order,
                    customerWarehouseById,
                    scopedWarehouses,
                    warehousesData || scopedWarehouses,
                ),
            );
        } else {
            scopedOrders = [];
        }
    }

    return { orders: scopedOrders, customerWarehouseById };
}
