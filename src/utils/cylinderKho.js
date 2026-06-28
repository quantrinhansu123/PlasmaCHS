/** Tên cột kho quản lý trên bảng cylinders. */
export const CYLINDER_KHO_COLUMN = 'kho';

/** Cột legacy — dùng fallback đọc/lọc khi kho chưa đồng bộ. */
export const CYLINDER_WAREHOUSE_LEGACY_COLUMN = 'warehouse';

const compactKhoKey = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^occ+(?=p)/, 'oc')
        .replace(/[^a-z0-9]/g, '');

const addKhoKeyVariants = (keys, rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return;
    keys.add(raw);
    keys.add(raw.toUpperCase());
    keys.add(raw.toLowerCase());
    const compact = compactKhoKey(raw);
    if (compact) {
        keys.add(compact);
        keys.add(compact.toUpperCase());
    }
};

/** Giá trị kho trên bình — ưu tiên cột kho, fallback warehouse khi chưa migrate. */
export function getCylinderKhoValue(cylinder) {
    if (String(cylinder?.status || '').trim().toLowerCase() === 'đã trả ncc') return '';
    return String(cylinder?.kho ?? cylinder?.warehouse ?? '').trim();
}

/** Mã/tên kho từ danh mục Kho (warehouses) — khớp cylinders.kho. */
export function buildCylinderKhoScopeKeys(warehouses = []) {
    const keys = new Set();
    (warehouses || []).forEach((warehouse) => {
        addKhoKeyVariants(keys, warehouse?.code);
        addKhoKeyVariants(keys, warehouse?.name);
        const name = String(warehouse?.name || '').trim();
        if (name.includes('-')) {
            addKhoKeyVariants(keys, name.split('-')[0].trim());
        }
    });
    return [...keys].filter(Boolean);
}

/** Dropdown «Kho Quản Lý» → khóa lọc cylinders.kho. */
export function expandCylinderKhoSelectionKeys(selectedIds = [], warehouses = []) {
    const records = (selectedIds || [])
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

    if (records.length) return buildCylinderKhoScopeKeys(records);

    return (selectedIds || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

const quotePostgrestInValue = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/[,()"\\\s]/.test(raw)) {
        return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return raw;
};

export const isMissingKhoColumnError = (error) => {
    const msg = String(error?.message || error?.details || '').toLowerCase();
    return (
        error?.code === '42703'
        || error?.code === 'PGRST204'
        || (msg.includes('kho') && (msg.includes('column') || msg.includes('does not exist')))
    );
};

/**
 * Lọc bình theo kho quản lý.
 * Ưu tiên cột kho; fallback warehouse nếu DB chưa đồng bộ kho.
 */
export function applyCylinderKhoFilterToQuery(query, warehouseKeys = [], options = {}) {
    const keys = [...new Set(
        (warehouseKeys || []).map((value) => String(value || '').trim()).filter(Boolean),
    )];
    if (!keys.length) return query;

    if (options.column === 'warehouse') {
        return query.in(CYLINDER_WAREHOUSE_LEGACY_COLUMN, keys);
    }
    if (options.column === 'kho' || options.legacyWarehouse === false) {
        return query.in(CYLINDER_KHO_COLUMN, keys);
    }

    const quoted = keys.map(quotePostgrestInValue).filter(Boolean).join(',');
    if (!quoted) return query;
    return query.or(`kho.in.(${quoted}),warehouse.in.(${quoted})`);
}

/** Khớp cylinders.kho với một dòng danh mục Kho (warehouses). */
export function cylinderKhoMatchesWarehouseRecord(cylinder, warehouse) {
    const stored = compactKhoKey(getCylinderKhoValue(cylinder));
    if (!stored || !warehouse) return false;
    return buildCylinderKhoScopeKeys([warehouse])
        .some((key) => compactKhoKey(key) === stored);
}
