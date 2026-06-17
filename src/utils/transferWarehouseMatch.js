import { normalizeMachineSerialKey } from './machineCustomerFromOrders';
import {
    buildCylinderWarehouseQueryKeys,
} from './orderWarehouseScope';

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
        [whRow.code, whRow.name, whRow.id, whRow.branch_office]
            .map((v) => String(v || '').trim())
            .filter(Boolean),
    );
    String(whRow.name || '')
        .split(/[\s,;/|()-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .forEach((t) => keys.add(t));
    return [...keys];
}

/** Alias kho giống modal Chi tiết kho (id, code, name, branch + gợi ý vùng). */
export function buildWarehouseModalAliases(warehouseInfo = {}) {
    const rawValues = [
        warehouseInfo?.id,
        warehouseInfo?.code,
        warehouseInfo?.name,
        warehouseInfo?.branch_office,
    ].filter(Boolean);

    const aliases = new Set();
    rawValues.forEach((value) => {
        const normalized = String(value).trim();
        if (normalized) aliases.add(normalized);
    });

    const combinedText = rawValues.map((value) => String(value).toLowerCase()).join(' ');
    if (combinedText.includes('ha noi') || combinedText.includes('hà nội')) aliases.add('HN');
    if (combinedText.includes('thanh hoa') || combinedText.includes('thanh hóa')) aliases.add('TH');
    if (combinedText.includes('da nang') || combinedText.includes('đà nẵng')) aliases.add('DN');
    if (
        combinedText.includes('hcm')
        || combinedText.includes('hồ chí minh')
        || combinedText.includes('ho chi minh')
        || combinedText.includes('tp.hcm')
    ) {
        aliases.add('TP.HCM');
        aliases.add('HCM');
    }
    if (combinedText.includes('ocp')) {
        aliases.add('OCP1');
        aliases.add('OCP 1');
    }

    return [...aliases];
}

export function buildWarehouseMatchKeys(whRow, warehouseRef = '', warehouseList = []) {
    const keys = new Set([
        ...warehouseStorageKeys(whRow),
        ...buildWarehouseModalAliases(whRow),
    ]);

    const ref = String(warehouseRef || '').trim();
    if (ref) keys.add(ref);

    (warehouseList || []).forEach((w) => {
        const rowKeys = warehouseStorageKeys(w);
        const matchesRef = rowKeys.some(
            (k) => k.toLowerCase() === ref.toLowerCase() || ref.toLowerCase().includes(k.toLowerCase()),
        );
        if (matchesRef) rowKeys.forEach((k) => keys.add(k));
    });

    return [...keys].filter(Boolean);
}

/** Tên kho để query cylinders.warehouse_id. */
function resolveCylinderWarehouseNameKeys(row, matchKeys, warehouseList) {
    let nameKeys = buildCylinderWarehouseQueryKeys([row]);

    (matchKeys || []).forEach((key) => {
        const trimmed = String(key || '').trim();
        if (!trimmed) return;
        const matched = (warehouseList || []).find(
            (w) => String(w?.name || '').trim().toLowerCase() === trimmed.toLowerCase()
                || String(w?.code || '').trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (matched?.name) nameKeys.push(String(matched.name).trim());
        else nameKeys.push(trimmed);
    });

    const matchedWarehouses = (warehouseList || []).filter((warehouse) => {
        const warehouseKeys = warehouseStorageKeys(warehouse);
        return (matchKeys || []).some((key) =>
            warehouseKeys.some((wk) => wk.toLowerCase() === String(key || '').trim().toLowerCase()),
        );
    });
    nameKeys = [...new Set([...nameKeys, ...buildCylinderWarehouseQueryKeys(matchedWarehouses)])];

    return nameKeys;
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

export function normalizeInventoryStatusKey(status) {
    return String(status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/** Khớp «Sẵn sàng» / «sẵn sàng» / biến thể không dấu trong DB. */
export function isReadyMachineStatus(status) {
    const s = normalizeInventoryStatusKey(status);
    if (!s) return false;
    if (
        s.includes('thuoc khach')
        || s.includes('dang su dung')
        || s.includes('bao tri')
        || s.includes('dang sua')
        || s.includes('kiem tra')
        || s.includes('da tra')
    ) {
        return false;
    }
    return s === 'san sang' || s.includes('san sang') || (s.includes('san') && s.includes('sang'));
}

const MACHINE_SELECT = 'id, machine_type, status, serial_number, warehouse';

/**
 * Lấy máy sẵn sàng tại kho — nhiều chiến lược khớp (mã/tên/UUID/ilike + quét sẵn sàng toàn hệ thống).
 */
export async function fetchReadyMachinesAtWarehouse(
    supabaseClient,
    { warehouseRef = '', warehouseList = [], whRow = null, warehouseId = null } = {},
) {
    const ref = String(warehouseRef || warehouseId || '').trim();
    if (!ref) return [];

    const row =
        whRow ||
        resolveWarehouseRow(ref, warehouseList) ||
        resolveWarehouseRow(warehouseId, warehouseList) ||
        { code: ref, name: ref, id: ref };

    const keys = buildWarehouseMatchKeys(row, ref, warehouseList);
    const collected = new Map();

    const absorb = (rows) => {
        (rows || []).forEach((m) => {
            if (!m?.id || !isReadyMachineStatus(m.status)) return;
            collected.set(m.id, m);
        });
    };

    const absorbIfWarehouseMatch = (rows) => {
        (rows || []).forEach((m) => {
            if (!m?.id || !isReadyMachineStatus(m.status)) return;
            if (
                machineBelongsToWarehouse(m.warehouse, ref, warehouseList)
                || machineBelongsToWarehouse(m.warehouse, warehouseId, warehouseList)
                || keys.some((k) => String(m.warehouse || '').trim().toLowerCase() === k.toLowerCase())
            ) {
                collected.set(m.id, m);
            }
        });
    };

    if (keys.length > 0) {
        const { data, error } = await supabaseClient
            .from('machines')
            .select(MACHINE_SELECT)
            .in('warehouse', keys)
            .limit(5000);
        if (!error) absorb(data);
    }

    for (const key of keys) {
        const safeKey = String(key || '').replace(/[%_]/g, '').trim();
        if (!safeKey) continue;

        const { data: exactReady } = await supabaseClient
            .from('machines')
            .select(MACHINE_SELECT)
            .eq('warehouse', safeKey)
            .eq('status', 'sẵn sàng')
            .limit(2000);
        absorb(exactReady);

        const { data: ilikeRows } = await supabaseClient
            .from('machines')
            .select(MACHINE_SELECT)
            .ilike('warehouse', `%${safeKey}%`)
            .limit(2000);
        absorb(ilikeRows);
    }

    const modalAliases = buildWarehouseModalAliases(row);
    if (modalAliases.length > 0) {
        const { data } = await supabaseClient
            .from('machines')
            .select(MACHINE_SELECT)
            .in('warehouse', modalAliases)
            .limit(5000);
        absorb(data);
    }

    if (collected.size === 0) {
        const { data: allReady, error } = await supabaseClient
            .from('machines')
            .select(MACHINE_SELECT)
            .eq('status', 'sẵn sàng')
            .limit(10000);
        if (!error) absorbIfWarehouseMatch(allReady);
    }

    return [...collected.values()].sort((a, b) =>
        String(a.serial_number || '').localeCompare(String(b.serial_number || ''), 'vi'),
    );
}

const CYLINDER_SELECT = 'id, serial_number, volume, status, warehouse_id';

/** Khớp «Sẵn sàng» / «sẵn sàng» / biến thể không dấu. */
export function isReadyCylinderStatus(status) {
    const s = normalizeInventoryStatusKey(status);
    if (!s) return false;
    if (
        s.includes('thuoc khach')
        || s.includes('dang su dung')
        || s.includes('dang van chuyen')
        || s.includes('da tra')
        || s.includes('bao tri')
    ) {
        return false;
    }
    return s === 'san sang' || s.includes('san sang') || (s.includes('san') && s.includes('sang'));
}

/**
 * Lấy bình sẵn sàng tại kho — khớp warehouse_id theo mã/tên/UUID (giống fetchReadyMachinesAtWarehouse).
 */
export async function fetchReadyCylindersAtWarehouse(
    supabaseClient,
    { warehouseRef = '', warehouseList = [], whRow = null, warehouseId = null } = {},
) {
    const ref = String(warehouseRef || warehouseId || '').trim();
    if (!ref) return [];

    const row =
        whRow ||
        resolveWarehouseRow(ref, warehouseList) ||
        resolveWarehouseRow(warehouseId, warehouseList) ||
        { code: ref, name: ref, id: ref };

    const keys = buildWarehouseMatchKeys(row, ref, warehouseList);
    const nameKeys = resolveCylinderWarehouseNameKeys(row, keys, warehouseList);
    const collected = new Map();

    const absorb = (rows) => {
        (rows || []).forEach((c) => {
            if (!c?.id || !isReadyCylinderStatus(c.status)) return;
            collected.set(c.id, c);
        });
    };

    const absorbIfWarehouseMatch = (rows) => {
        (rows || []).forEach((c) => {
            if (!c?.id || !isReadyCylinderStatus(c.status)) return;
            if (
                cylinderBelongsToWarehouse(c.warehouse_id, ref, warehouseList)
                || cylinderBelongsToWarehouse(c.warehouse_id, warehouseId, warehouseList)
                || keys.some((k) => String(c.warehouse_id || '').trim().toLowerCase() === k.toLowerCase())
            ) {
                collected.set(c.id, c);
            }
        });
    };

    if (nameKeys.length > 0) {
        const { data, error } = await supabaseClient
            .from('cylinders')
            .select(CYLINDER_SELECT)
            .in('warehouse_id', nameKeys)
            .limit(5000);
        if (!error) absorb(data);
    }

    if (collected.size === 0) {
        const { data: allReady, error } = await supabaseClient
            .from('cylinders')
            .select(CYLINDER_SELECT)
            .eq('status', 'sẵn sàng')
            .limit(10000);
        if (!error) absorbIfWarehouseMatch(allReady);

        if (collected.size === 0 && !error) {
            const { data: allReadyLoose } = await supabaseClient
                .from('cylinders')
                .select(CYLINDER_SELECT)
                .limit(10000);
            absorbIfWarehouseMatch(allReadyLoose);
        }
    }

    return [...collected.values()].sort((a, b) =>
        String(a.serial_number || '').localeCompare(String(b.serial_number || ''), 'vi'),
    );
}
