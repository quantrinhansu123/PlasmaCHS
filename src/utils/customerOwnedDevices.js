import {
    collectCylinderSerialsFromOrderForCustomer,
    CYLINDER_STATUSES_AT_CUSTOMER,
    isOrderCustomerCylinderVisible,
    MACHINE_STATUSES_ENRICH_CUSTOMER_FROM_ORDERS,
    normalizeMachineSerialKey,
} from './machineCustomerFromOrders';
import { collectMachineSerialsForOrder } from './orderMachineSerials';

function escapeIlikeOrFragment(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/,/g, '');
}

function chunkArray(arr, chunkSize) {
    const out = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        out.push(arr.slice(i, i + chunkSize));
    }
    return out;
}

function serialVariantsForLookup(serialRaw) {
    const t = String(serialRaw || '').trim();
    if (!t) return [];
    const collapsed = t.replace(/\s+/g, '');
    return [...new Set([t, collapsed, t.toUpperCase(), t.toLowerCase(), collapsed.toUpperCase(), collapsed.toLowerCase()])].filter(
        Boolean,
    );
}

function machineSerialHintsFromCustomerRecord(cust) {
    const raw = cust?.machines_in_use;
    if (raw == null || raw === '') return [];
    if (typeof raw === 'number') return [String(raw)];
    let s = String(raw).trim();
    if (!s) return [];
    try {
        const j = JSON.parse(s);
        if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
        if (j && typeof j === 'object') {
            const arr = j.serials || j.machines || j.serial_numbers;
            if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
        }
    } catch {
        /* not JSON */
    }
    return s.split(/[\n,;/|]+/).map((x) => String(x).trim()).filter(Boolean);
}

export function getCustomerLookupNames(customer) {
    const names = new Set();
    const add = (value) => {
        const text = String(value || '').trim();
        if (text) names.add(text);
    };
    if (!customer) return [];
    add(customer.name);
    add(customer.legal_rep);
    add(customer.representative);
    add(customer.invoice_company_name);
    return [...names];
}

function normalizeNameKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function customerOwnsAssetName(assetCustomerName, customer) {
    const assetKey = normalizeNameKey(assetCustomerName);
    if (!assetKey) return false;
    return getCustomerLookupNames(customer).some((name) => {
        const nameKey = normalizeNameKey(name);
        if (!nameKey) return false;
        return assetKey === nameKey || assetKey.includes(nameKey) || nameKey.includes(assetKey);
    });
}

function formatDeviceLabel(rawType, fallback) {
    if (!rawType) return fallback;
    let formatted = rawType.toString().replace(/_/g, ' ');
    if (formatted.toUpperCase().startsWith('BINH')) formatted = formatted.replace(/BINH/i, 'Bình');
    if (formatted.toUpperCase().startsWith('MAY')) formatted = formatted.replace(/MAY/i, 'Máy');
    return formatted;
}

function mapMachineRow(machine) {
    const serial = String(machine.serial_number || '').trim();
    if (!serial) return null;
    return {
        serial_number: serial,
        name: formatDeviceLabel(machine.machine_type, 'Máy'),
        category: 'Máy',
        site: machine.department_in_charge || '',
    };
}

function mapCylinderRow(cylinder) {
    const serial = String(cylinder.serial_number || '').trim();
    if (!serial) return null;
    const label = [formatDeviceLabel(cylinder.category, 'Bình'), cylinder.volume].filter(Boolean).join(' · ');
    return {
        serial_number: serial,
        name: label || 'Bình',
        category: 'Bình',
        site: '',
    };
}

/**
 * Lấy máy/bình khách đang sở hữu — khớp tên cơ sở, người đại diện, customer_id, đơn hàng.
 */
export async function fetchCustomerOwnedDevices(supabaseClient, customer) {
    const custId = customer?.id;
    const lookupNames = getCustomerLookupNames(customer);
    if (!custId && lookupNames.length === 0) return [];

    const machinesById = new Map();
    const cylindersById = new Map();
    const nameMatchedMachineIds = new Set();
    const nameMatchedCylinderIds = new Set();
    const machineSerialNormFromOrders = new Set();
    const rawMachineSerialsFromOrders = new Set();
    const cylinderSerialRawFromOrders = new Set();

    const markMachine = (row) => {
        if (!row?.id) return;
        machinesById.set(row.id, row);
    };
    const markMachineByName = (row) => {
        markMachine(row);
        if (row?.id) nameMatchedMachineIds.add(row.id);
    };
    const markCylinder = (row) => {
        if (!row?.id) return;
        cylindersById.set(row.id, row);
    };
    const markCylinderByName = (row) => {
        markCylinder(row);
        if (row?.id) nameMatchedCylinderIds.add(row.id);
    };

    const machineCols =
        'id, serial_number, machine_type, status, customer_name, department_in_charge';
    const cylinderCols = 'id, serial_number, volume, category, status, customer_name';

    for (const name of lookupNames) {
        const { data: mExact } = await supabaseClient.from('machines').select(machineCols).eq('customer_name', name);
        (mExact || []).forEach(markMachineByName);

        if (name.length >= 3) {
            const esc = escapeIlikeOrFragment(name);
            const { data: mLike } = await supabaseClient
                .from('machines')
                .select(machineCols)
                .ilike('customer_name', `%${esc}%`);
            (mLike || []).forEach(markMachineByName);
        }
    }

    if (custId) {
        const { data: cylById } = await supabaseClient.from('cylinders').select(cylinderCols).eq('customer_id', custId);
        (cylById || []).forEach(markCylinderByName);
    }

    for (const name of lookupNames) {
        const { data: cExact } = await supabaseClient.from('cylinders').select(cylinderCols).eq('customer_name', name);
        (cExact || []).forEach(markCylinderByName);

        if (name.length >= 3) {
            const esc = escapeIlikeOrFragment(name);
            const { data: cLike } = await supabaseClient
                .from('cylinders')
                .select(cylinderCols)
                .ilike('customer_name', `%${esc}%`);
            (cLike || []).forEach(markCylinderByName);
        }
    }

    const orderMap = new Map();
    const mergeOrder = (o) => {
        if (o?.id && !orderMap.has(o.id)) orderMap.set(o.id, o);
    };

    const orderSelect = 'id, status, delivery_checklist, customer_name, recipient_name, assigned_cylinders';
    if (custId) {
        const { data: o1 } = await supabaseClient.from('orders').select(orderSelect).eq('customer_id', custId);
        (o1 || []).forEach(mergeOrder);
    }
    for (const name of lookupNames) {
        const { data: o2 } = await supabaseClient.from('orders').select(orderSelect).eq('customer_name', name);
        (o2 || []).forEach(mergeOrder);
        if (name.length >= 3) {
            const esc = escapeIlikeOrFragment(name);
            const { data: o3 } = await supabaseClient
                .from('orders')
                .select(orderSelect)
                .ilike('recipient_name', `%${esc}%`);
            (o3 || []).forEach(mergeOrder);
        }
    }

    for (const hint of machineSerialHintsFromCustomerRecord(customer)) {
        serialVariantsForLookup(hint).forEach((v) => rawMachineSerialsFromOrders.add(v));
        machineSerialNormFromOrders.add(normalizeMachineSerialKey(hint));
    }

    const orderIds = [...orderMap.keys()];
    const itemsByOrderId = new Map();
    for (const part of chunkArray(orderIds, 100)) {
        if (!part.length) continue;
        const { data: items } = await supabaseClient
            .from('order_items')
            .select('order_id, serial_number, product_type')
            .in('order_id', part);
        for (const it of items || []) {
            if (!it.order_id) continue;
            if (!itemsByOrderId.has(it.order_id)) itemsByOrderId.set(it.order_id, []);
            itemsByOrderId.get(it.order_id).push(it);
        }
    }

    const checklistForOrder = (o) => {
        const raw = o?.delivery_checklist;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch {
                /* ignore */
            }
        }
        return {};
    };

    for (const o of orderMap.values()) {
        const items = itemsByOrderId.get(o.id) || [];
        const cl = checklistForOrder(o);
        for (const sn of collectMachineSerialsForOrder(o, items, cl)) {
            serialVariantsForLookup(sn).forEach((v) => rawMachineSerialsFromOrders.add(v));
            machineSerialNormFromOrders.add(normalizeMachineSerialKey(sn));
        }
    }

    for (const o of orderMap.values()) {
        if (!isOrderCustomerCylinderVisible(o.status)) continue;
        const items = itemsByOrderId.get(o.id) || [];
        for (const sn of collectCylinderSerialsFromOrderForCustomer(o, items)) {
            cylinderSerialRawFromOrders.add(sn);
        }
    }

    for (const part of chunkArray([...rawMachineSerialsFromOrders], 60)) {
        if (!part.length) continue;
        const { data: mBySerial } = await supabaseClient.from('machines').select(machineCols).in('serial_number', part);
        (mBySerial || []).forEach(markMachine);
    }

    for (const part of chunkArray([...cylinderSerialRawFromOrders], 80)) {
        if (!part.length) continue;
        const { data: cBySerial } = await supabaseClient.from('cylinders').select(cylinderCols).in('serial_number', part);
        (cBySerial || []).forEach(markCylinder);
    }

    const cylinderSerMatch = (c) => {
        const rs = String(c.serial_number || '').trim();
        return (
            cylinderSerialRawFromOrders.has(rs) ||
            cylinderSerialRawFromOrders.has(rs.replace(/\s+/g, ''))
        );
    };

    const devices = [];

    for (const m of machinesById.values()) {
        const st = String(m.status || '').trim();
        const snKey = normalizeMachineSerialKey(m.serial_number);
        const owned =
            nameMatchedMachineIds.has(m.id) ||
            MACHINE_STATUSES_ENRICH_CUSTOMER_FROM_ORDERS.has(st) ||
            machineSerialNormFromOrders.has(snKey);
        if (!owned) continue;
        const mapped = mapMachineRow(m);
        if (mapped) devices.push(mapped);
    }

    for (const c of cylindersById.values()) {
        const st = String(c.status || '').trim();
        const owned =
            nameMatchedCylinderIds.has(c.id) ||
            CYLINDER_STATUSES_AT_CUSTOMER.has(st) ||
            cylinderSerMatch(c);
        if (!owned) continue;
        const mapped = mapCylinderRow(c);
        if (mapped) devices.push(mapped);
    }

    const serialMap = new Map();
    devices.forEach((d) => {
        serialMap.set(d.serial_number.toUpperCase(), d);
    });

    return Array.from(serialMap.values()).sort((a, b) =>
        a.serial_number.localeCompare(b.serial_number, 'vi', { sensitivity: 'base' }),
    );
}

/** Vỏ bình khách đang giữ — dùng dropdown phiếu thu hồi vỏ. */
export async function fetchCustomerOwnedCylinders(supabaseClient, customer) {
    const custId = customer?.id;
    const lookupNames = getCustomerLookupNames(customer);
    if (!custId && lookupNames.length === 0) return [];

    const cylindersById = new Map();
    const nameMatchedCylinderIds = new Set();
    const cylinderSerialRawFromOrders = new Set();

    const markCylinder = (row) => {
        if (!row?.id) return;
        cylindersById.set(row.id, row);
    };
    const markCylinderByName = (row) => {
        markCylinder(row);
        if (row?.id) nameMatchedCylinderIds.add(row.id);
    };

    const cylinderCols = 'id, serial_number, volume, category, status, customer_name';

    if (custId) {
        const { data: cylById } = await supabaseClient.from('cylinders').select(cylinderCols).eq('customer_id', custId);
        (cylById || []).forEach(markCylinderByName);
    }

    for (const name of lookupNames) {
        const { data: cExact } = await supabaseClient.from('cylinders').select(cylinderCols).eq('customer_name', name);
        (cExact || []).forEach(markCylinderByName);

        if (name.length >= 3) {
            const esc = escapeIlikeOrFragment(name);
            const { data: cLike } = await supabaseClient
                .from('cylinders')
                .select(cylinderCols)
                .ilike('customer_name', `%${esc}%`);
            (cLike || []).forEach(markCylinderByName);
        }
    }

    const orderMap = new Map();
    const mergeOrder = (o) => {
        if (o?.id && !orderMap.has(o.id)) orderMap.set(o.id, o);
    };
    const orderSelect = 'id, status, assigned_cylinders, delivery_checklist';
    if (custId) {
        const { data: o1 } = await supabaseClient.from('orders').select(orderSelect).eq('customer_id', custId);
        (o1 || []).forEach(mergeOrder);
    }
    for (const name of lookupNames) {
        const { data: o2 } = await supabaseClient.from('orders').select(orderSelect).eq('customer_name', name);
        (o2 || []).forEach(mergeOrder);
    }

    const orderIds = [...orderMap.keys()];
    const itemsByOrderId = new Map();
    for (const part of chunkArray(orderIds, 100)) {
        if (!part.length) continue;
        const { data: items } = await supabaseClient
            .from('order_items')
            .select('order_id, serial_number, product_type')
            .in('order_id', part);
        for (const it of items || []) {
            if (!it.order_id) continue;
            if (!itemsByOrderId.has(it.order_id)) itemsByOrderId.set(it.order_id, []);
            itemsByOrderId.get(it.order_id).push(it);
        }
    }

    for (const o of orderMap.values()) {
        if (!isOrderCustomerCylinderVisible(o.status)) continue;
        const items = itemsByOrderId.get(o.id) || [];
        for (const sn of collectCylinderSerialsFromOrderForCustomer(o, items)) {
            cylinderSerialRawFromOrders.add(sn);
        }
    }

    for (const part of chunkArray([...cylinderSerialRawFromOrders], 80)) {
        if (!part.length) continue;
        const { data: cBySerial } = await supabaseClient.from('cylinders').select(cylinderCols).in('serial_number', part);
        (cBySerial || []).forEach(markCylinder);
    }

    const cylinderSerMatch = (c) => {
        const rs = String(c.serial_number || '').trim();
        return (
            cylinderSerialRawFromOrders.has(rs) ||
            cylinderSerialRawFromOrders.has(rs.replace(/\s+/g, ''))
        );
    };

    const owned = [...cylindersById.values()].filter((c) => {
        const st = String(c.status || '').trim();
        return (
            nameMatchedCylinderIds.has(c.id) ||
            CYLINDER_STATUSES_AT_CUSTOMER.has(st) ||
            cylinderSerMatch(c) ||
            customerOwnsAssetName(c.customer_name, customer)
        );
    });

    const serialMap = new Map();
    owned.forEach((c) => {
        const serial = String(c.serial_number || '').trim();
        if (!serial) return;
        serialMap.set(serial.toUpperCase(), {
            serial_number: serial,
            volume: c.volume || '',
            customer_name: c.customer_name || '',
            status: c.status || '',
        });
    });

    return Array.from(serialMap.values()).sort((a, b) =>
        a.serial_number.localeCompare(b.serial_number, 'vi', { sensitivity: 'base' }),
    );
}
