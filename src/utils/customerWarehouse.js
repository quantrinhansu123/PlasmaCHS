export const CUSTOMER_WAREHOUSE_DEFAULT_CODE = 'OCP1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KNOWN_WAREHOUSE_CODES = new Set([
    'OCP1',
    'OCP',
    'HN',
    'DN',
    'CT',
    'TH',
    'NM',
    'NMK',
    'VQ',
    'VPMN',
    'TP.HCM',
    'HCM',
]);

const normalizeKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

function isKnownWarehouseCode(value) {
    const upper = String(value || '').trim().toUpperCase();
    return KNOWN_WAREHOUSE_CODES.has(upper);
}

/** Kho OCP1 trong danh mục — ưu tiên khi lưu KH. */
export function resolvePreferredWarehouseRecord(warehousesList = []) {
    const list = warehousesList || [];
    return (
        list.find((w) => String(w?.code || '').trim().toUpperCase() === CUSTOMER_WAREHOUSE_DEFAULT_CODE)
        || list.find((w) => normalizeKey(w?.name).includes('ocp1') || normalizeKey(w?.name).includes('ocp 1'))
        || list[0]
        || null
    );
}

export function resolvePreferredWarehouseId(warehousesList = []) {
    return String(resolvePreferredWarehouseRecord(warehousesList)?.id || '').trim();
}

/**
 * Giá trị ghi DB customers.warehouse_id.
 * - Cột UUID (DB cũ): trả về warehouses.id của OCP1
 * - Cột TEXT (sau migrate): trả về mã OCP1
 */
export function resolveCustomerWarehouseForDatabase(warehouseValue, warehousesList = []) {
    const raw = String(warehouseValue || '').trim();
    const preferred = resolvePreferredWarehouseRecord(warehousesList);

    if (UUID_RE.test(raw)) return raw;
    if (preferred?.id) return preferred.id;

    const fromCode = resolveWarehouseCodeFromList(raw, warehousesList);
    if (fromCode && isKnownWarehouseCode(fromCode)) return fromCode;

    return CUSTOMER_WAREHOUSE_DEFAULT_CODE;
}

function resolveWarehouseCodeFromList(raw, warehousesList = []) {
    const list = warehousesList || [];
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';

    const byId = list.find((warehouse) => String(warehouse?.id || '').trim() === trimmed);
    if (byId?.code) return String(byId.code).trim().toUpperCase();

    const lowered = normalizeKey(trimmed);
    const matched = list.find((warehouse) => {
        const code = normalizeKey(warehouse?.code);
        const name = normalizeKey(warehouse?.name);
        return code === lowered || name === lowered;
    });
    if (matched?.code) return String(matched.code).trim().toUpperCase();

    return '';
}

/** @deprecated dùng resolveCustomerWarehouseForDatabase */
export function normalizeCustomerWarehouseStorage(warehouseValue, warehousesList = []) {
    return resolveCustomerWarehouseForDatabase(warehouseValue, warehousesList);
}

/** value cho option — UUID kho (tương thích DB cũ). */
export function getCustomerWarehouseOptionValue(warehouse) {
    return String(warehouse?.id || '').trim();
}

/** label hiển thị trong select — luôn OCP1. */
export function getCustomerWarehouseOptionLabel() {
    return CUSTOMER_WAREHOUSE_DEFAULT_CODE;
}

/** Hiển thị cột Kho phụ trách — luôn text OCP1. */
export function getCustomerWarehouseDisplayCode() {
    return CUSTOMER_WAREHOUSE_DEFAULT_CODE;
}

/** Giá trị controlled select khi mở form sửa KH. */
export function resolveCustomerWarehouseSelectValue(warehouseValue, warehousesList = []) {
    const raw = String(warehouseValue || '').trim();
    if (UUID_RE.test(raw)) return raw;
    const preferredId = resolvePreferredWarehouseId(warehousesList);
    if (preferredId) return preferredId;
    return CUSTOMER_WAREHOUSE_DEFAULT_CODE;
}
