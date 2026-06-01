import { normalizeMachineSerialKey } from './machineCustomerFromOrders';

/** Biến thể serial máy để .in() khớp DB (phân biệt hoa thường / khoảng trắng). */
export function machineSerialLookupVariants(raw) {
    const t = String(raw || '').trim();
    if (!t) return [];
    const collapsed = normalizeMachineSerialKey(t);
    return [...new Set([t, t.toUpperCase(), t.toLowerCase(), collapsed, collapsed.toLowerCase()])].filter(
        Boolean,
    );
}

export function normalizeSerialInput(raw, itemType) {
    const t = String(raw || '').trim();
    if (!t) return '';
    if (itemType === 'MAY') return normalizeMachineSerialKey(t) || t.toUpperCase();
    if (String(itemType || '').startsWith('BINH')) return t.replace(/\s+/g, '').toUpperCase();
    return t.toUpperCase();
}

export function indexSerialRecords(records, itemType) {
    const map = {};
    (records || []).forEach((row) => {
        const sn = String(row?.serial_number || '').trim();
        if (!sn) return;
        const keys =
            itemType === 'MAY'
                ? machineSerialLookupVariants(sn)
                : [...new Set([sn, sn.toUpperCase(), sn.replace(/\s+/g, '').toUpperCase()])];
        keys.forEach((k) => {
            map[k] = row;
        });
    });
    return map;
}

export function resolveDbRecord(map, code, itemType) {
    if (!code) return null;
    const direct = map[code];
    if (direct) return direct;
    const norm = normalizeSerialInput(code, itemType);
    return map[norm] || null;
}

export function resolveWarehouseRow(warehouseId, warehouseList = []) {
    const key = String(warehouseId || '').trim();
    if (!key) return null;
    return (
        warehouseList.find((w) => String(w.id) === key) ||
        warehouseList.find((w) => String(w.code || '').trim() === key) ||
        warehouseList.find((w) => String(w.name || '').trim() === key) ||
        null
    );
}

export function warehouseStorageKeys(whRow) {
    if (!whRow) return [];
    const keys = new Set(
        [whRow.code, whRow.name, whRow.id].map((v) => String(v || '').trim()).filter(Boolean),
    );
    String(whRow.name || '')
        .split(/[\s,;/|()-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .forEach((t) => keys.add(t));
    return [...keys];
}

export function storedValueMatchesWarehouse(storedValue, fromWarehouseId, warehouseList = []) {
    const v = String(storedValue || '').trim();
    if (!v) return false;
    const whRow = resolveWarehouseRow(fromWarehouseId, warehouseList);
    const keys = warehouseStorageKeys(whRow);
    if (keys.length === 0) return v === String(fromWarehouseId || '').trim();
    if (keys.includes(v)) return true;
    const vLow = v.toLowerCase();
    return keys.some((k) => {
        const kl = k.toLowerCase();
        return kl === vLow || vLow.includes(kl) || kl.includes(vLow);
    });
}

export function machineBelongsToWarehouse(storedWarehouse, fromWarehouseId, warehouseList) {
    return storedValueMatchesWarehouse(storedWarehouse, fromWarehouseId, warehouseList);
}

export function cylinderBelongsToWarehouse(storedWarehouseId, fromWarehouseId, warehouseList) {
    return storedValueMatchesWarehouse(storedWarehouseId, fromWarehouseId, warehouseList);
}

export function collectSerialQueryVariants(codes, itemType) {
    const set = new Set();
    (codes || []).forEach((code) => {
        const c = String(code || '').trim();
        if (!c) return;
        if (itemType === 'MAY') {
            machineSerialLookupVariants(c).forEach((v) => set.add(v));
        } else {
            [c, c.toUpperCase(), c.replace(/\s+/g, '').toUpperCase()].forEach((v) => set.add(v));
        }
    });
    return [...set];
}
