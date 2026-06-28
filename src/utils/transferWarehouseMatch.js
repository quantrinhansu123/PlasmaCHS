import { normalizeMachineSerialKey } from './machineCustomerFromOrders';
import {
    CYLINDER_KHO_COLUMN,
    applyCylinderKhoFilterToQuery,
    getCylinderKhoValue,
    isMissingKhoColumnError,
} from './cylinderKho';
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

/** Mã kho để query cylinders.warehouse. */
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

const CYLINDER_SELECT = `id, serial_number, volume, status, ${CYLINDER_KHO_COLUMN}`;

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
                cylinderBelongsToWarehouse(getCylinderKhoValue(c), ref, warehouseList)
                || cylinderBelongsToWarehouse(getCylinderKhoValue(c), warehouseId, warehouseList)
                || keys.some((k) => getCylinderKhoValue(c).toLowerCase() === k.toLowerCase())
            ) {
                collected.set(c.id, c);
            }
        });
    };

    if (nameKeys.length > 0) {
        const { data, error } = await applyCylinderKhoFilterToQuery(
            supabaseClient.from('cylinders').select(CYLINDER_SELECT),
            nameKeys,
        ).limit(5000);
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

const CYLINDER_RETURN_SELECT = 'id, serial_number, status, volume, kho, warehouse, customer_name, supplier_id';

function applyGoodsIssueCylinderStatusFilter(query, issueType) {
    if (issueType === 'TRA_VO') {
        return query.in('status', ['bình rỗng']);
    }
    return query.not('status', 'in', '("đang sử dụng", "thuộc khách hàng", "đã trả ncc")');
}

function cylinderMatchesWarehouseKeys(cylinder, ref, warehouseList, matchKeys) {
    const stored = getCylinderKhoValue(cylinder);
    if (!stored) return false;
    if (cylinderBelongsToWarehouse(stored, ref, warehouseList)) return true;
    return (matchKeys || []).some(
        (key) => stored.toLowerCase() === String(key || '').trim().toLowerCase(),
    );
}

/**
 * Bình khả dụng cho phiếu xuất trả NCC — khớp kho linh hoạt (kho/warehouse/mã/tên/alias).
 */
export async function fetchReturnableCylindersAtWarehouse(
    supabaseClient,
    { warehouseRef = '', warehouseList = [], whRow = null, issueType = 'TRA_VO' } = {},
) {
    const ref = String(warehouseRef || '').trim();
    if (!ref) return [];

    const row =
        whRow ||
        resolveWarehouseRow(ref, warehouseList) ||
        { code: ref, name: ref, id: ref };

    const matchKeys = buildWarehouseMatchKeys(row, ref, warehouseList);
    const nameKeys = [
        ...new Set([
            ...buildCylinderWarehouseQueryKeys([row]),
            ...matchKeys,
            ref,
        ]),
    ].filter(Boolean);

    const runQuery = async (filterMode = 'default') => {
        let query = supabaseClient.from('cylinders').select(CYLINDER_RETURN_SELECT);
        const options =
            filterMode === 'warehouse'
                ? { column: 'warehouse' }
                : filterMode === 'kho'
                    ? { column: 'kho', legacyWarehouse: false }
                    : {};
        query = applyCylinderKhoFilterToQuery(query, nameKeys, options);
        query = applyGoodsIssueCylinderStatusFilter(query, issueType);
        return query.limit(5000);
    };

    let { data, error } = await runQuery('default');

    if (error && isMissingKhoColumnError(error)) {
        ({ data, error } = await runQuery('warehouse'));
    }

    if (!error && (!data || data.length === 0)) {
        const retry = await runQuery('warehouse');
        if (!retry.error && retry.data?.length > 0) {
            data = retry.data;
        }
    }

    if (!error && (!data || data.length === 0)) {
        const { data: allRows, error: scanError } = await applyGoodsIssueCylinderStatusFilter(
            supabaseClient.from('cylinders').select(CYLINDER_RETURN_SELECT),
            issueType,
        ).limit(10000);

        if (!scanError && allRows?.length) {
            data = allRows.filter((cylinder) =>
                cylinderMatchesWarehouseKeys(cylinder, ref, warehouseList, matchKeys),
            );
        }
    }

    return (data || []).sort((a, b) =>
        String(a.serial_number || '').localeCompare(String(b.serial_number || ''), 'vi'),
    );
}

/** Tên dòng bình trên phiếu điều chuyển — tránh «Bình bình …» khi volume đã có tiền tố. */
export function formatCylinderTransferItemName(volume) {
    const v = String(volume ?? '').trim();
    if (!v) return 'Bình khác';
    if (/^bình\b/i.test(v)) return v;
    return `Bình ${v}`;
}

/** Tên dòng máy trên phiếu điều chuyển. */
export function formatMachineTransferItemName(machineType) {
    const v = String(machineType ?? '').trim();
    if (!v) return 'Máy';
    if (/^m[aá]y\b/i.test(v)) return v;
    return `Máy ${v}`;
}

/** Biến thể tên hàng để khớp bảng inventory (dữ liệu cũ có thể khác nhãn). */
export function transferInventoryItemNameVariants(itemName) {
    const names = new Set();
    const t = String(itemName || '').trim();
    if (!t) return [];
    names.add(t);
    if (/^Bình\s+bình/i.test(t)) names.add(t.replace(/^Bình\s+/i, ''));
    if (/^Máy\s+m[aá]y/i.test(t)) names.add(t.replace(/^Máy\s+/i, ''));
    return [...names];
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isWarehouseUuidLike(value) {
    return UUID_LIKE.test(String(value || '').trim());
}

/** Khóa tra cứu inventory.warehouse_id — tên kho trước; không dùng UUID. */
export function buildInventoryWarehouseLookupKeys(whRow, warehouseRef = '') {
    const keys = new Set();
    const name = String(whRow?.name || '').trim();
    if (name) keys.add(name);
    const code = String(whRow?.code || '').trim();
    if (code && code !== name) keys.add(code);
    const ref = String(warehouseRef || '').trim();
    if (ref && !isWarehouseUuidLike(ref) && ref !== name) keys.add(ref);
    return [...keys];
}

export async function findInventoryRowForTransfer(
    supabaseClient,
    { warehouseKeys = [], itemType, itemName },
) {
    const names = transferInventoryItemNameVariants(itemName);
    for (const wh of warehouseKeys) {
        for (const name of names) {
            const { data, error } = await supabaseClient
                .from('inventory')
                .select('id, quantity')
                .eq('warehouse_id', wh)
                .eq('item_type', itemType)
                .eq('item_name', name)
                .maybeSingle();
            if (error) throw error;
            if (data) return { ...data, matchedWarehouseId: wh, matchedItemName: name };
        }
    }
    return null;
}
