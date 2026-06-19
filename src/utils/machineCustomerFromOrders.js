/**
 * Khớp serial máy giữa machines.* và order_items (bỏ khoảng trắng, NFC, upper).
 */
export function normalizeMachineSerialKey(serial) {
    return String(serial || '')
        .normalize('NFC')
        .replace(/\s+/g, '')
        .toUpperCase();
}

/** Trạng thái máy nên ưu tiên hiển thị khách từ đơn giao (không chỉ “thuộc khách hàng”). */
export const MACHINE_STATUSES_ENRICH_CUSTOMER_FROM_ORDERS = new Set([
    'thuộc khách hàng',
    'kiểm tra',
    'đang sử dụng',
    'bảo trì',
    'đang sửa',
]);

export function isDnxmOrder(order) {
    if (!order) return false;
    const type = String(order.order_type || '').trim().toUpperCase();
    if (type === 'DNXM') return true;
    return String(order.order_code || '').trim().toUpperCase().startsWith('DNXM');
}

/** Tên cơ sở khách đang dùng máy (không dùng tên người đại diện). */
export function resolveOrderCustomerDisplay(order, customersById = {}) {
    if (!order) return '';
    const cid = order.customer_id;
    if (cid && customersById[cid]?.name) {
        return String(customersById[cid].name).trim();
    }
    if (isDnxmOrder(order)) {
        return String(order.recipient_name || order.customer_name || '').trim();
    }
    return String(order.customer_name || order.recipient_name || '').trim();
}

function extractWarehouseFromOrderNote(note) {
    const text = String(note || '');
    if (!text) return '';
    const match = text.match(/Kho:\s*([^\n\r.]+)/i);
    return (match?.[1] || '').trim();
}

/** Mã/tên kho quản lý từ đơn giao máy (orders.warehouse, hồ sơ KH, hoặc dòng Kho: trong note ĐNXM). */
export function resolveOrderWarehouseForMachine(order, customerWarehouseById = {}) {
    if (!order) return '';
    const fromOrder = String(order.warehouse || '').trim();
    if (fromOrder) return fromOrder;
    const cid = order.customer_id;
    if (cid && customerWarehouseById[cid]) {
        return String(customerWarehouseById[cid]).trim();
    }
    return extractWarehouseFromOrderNote(order.note);
}

/** Các giá trị có thể có trong cột orders.status — dùng với .in('status', …) */
export const ORDER_DELIVERED_STATUS_DB_VALUES = [
    'HOAN_THANH',
    'HOÀN THÀNH',
    'Hoàn thành',
    /** Gạch dưới giữa “HOÀN” và “THÀNH” (một số UI/badge) */
    'HOÀN' + '_' + 'THÀNH',
];

/**
 * Đơn đã hoàn thành giao/xử lý — DB hoặc UI có thể dùng dấu, gạch dưới, khoảng trắng khác nhau.
 */
export function isOrderDeliveredCompleted(status) {
    if (status === null || status === undefined) return false;
    const raw = String(status).trim();
    if (ORDER_DELIVERED_STATUS_DB_VALUES.includes(raw)) return true;
    /** Unicode \p{M}: mọi dấu/ghi chú combining (tiếng Việt không phải lúc nào cũng trong U+0300–036F sau NFD). */
    const strip = (s) => String(s).normalize('NFD').replace(/\p{M}+/gu, '');
    const deAcc = strip(raw);
    if (ORDER_DELIVERED_STATUS_DB_VALUES.some((v) => deAcc === strip(v))) return true;
    const compact = deAcc.replace(/\s+/g, '').replace(/_/g, '').toUpperCase();
    return compact === 'HOANTHANH';
}

/** Gom dòng order_items có thể thuộc serial (nhiều biến thể lưu DB). */
export async function fetchOrderItemsForMachineSerialVariants(supabaseClient, serialRaw) {
    const serial = String(serialRaw || '').trim();
    if (!serial) return [];

    const variants = [
        ...new Set([
            serial,
            serial.replace(/\s+/g, ' ').trim(),
            serial.replace(/\s+/g, ''),
        ]),
    ].filter(Boolean);

    const byOrderProduct = new Map();
    const add = (rows) => {
        (rows || []).forEach((r) => {
            if (!r?.order_id) return;
            const k = `${r.order_id}\0${r.product_type || ''}\0${r.serial_number || ''}`;
            if (!byOrderProduct.has(k)) byOrderProduct.set(k, r);
        });
    };

    for (const v of variants) {
        const { data } = await supabaseClient
            .from('order_items')
            .select('order_id, product_type, serial_number')
            .eq('serial_number', v);
        add(data);
    }

    if (byOrderProduct.size === 0) {
        const esc = String(serial)
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_')
            .replace(/,/g, '');
        const p = `%${esc}%`;
        const { data } = await supabaseClient
            .from('order_items')
            .select('order_id, product_type, serial_number')
            .ilike('serial_number', p);
        add(data);
    }

    return [...byOrderProduct.values()];
}

export function normalizeCustomerLookupKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Map tên/đại diện KH → mã hoặc field khác (code, warehouse_id…). */
export function buildCustomerFieldByLabelMap(customers = [], field = 'code') {
    /** @type {Record<string, string>} */
    const map = {};
    (customers || []).forEach((customer) => {
        const value = String(customer?.[field] || '').trim();
        if (!value) return;
        [customer.name, customer.legal_rep, customer.invoice_company_name].forEach((label) => {
            const key = normalizeCustomerLookupKey(label);
            if (key) map[key] = value;
        });
    });
    return map;
}

export function resolveCustomerFieldFromMachineLabel(label, map = {}) {
    const raw = String(label || '').trim();
    if (!raw) return '';
    const baseName = raw.split(' / ')[0].trim();
    for (const candidate of [raw, baseName]) {
        const key = normalizeCustomerLookupKey(candidate);
        if (key && map[key]) return map[key];
    }
    return '';
}

/** Gắn mã KH (customers.code) theo tên cơ sở trên máy. */
export async function attachCustomerCodesToMachines(supabaseClient, machineRows) {
    const rows = machineRows || [];
    const needsCode = rows.some(
        (machine) => String(machine.customer_name || '').trim() && !String(machine.customer_code || '').trim(),
    );
    if (!needsCode) return rows;

    const { data: customers, error } = await supabaseClient
        .from('customers')
        .select('id, code, name, legal_rep, invoice_company_name')
        .not('code', 'is', null);

    if (error) {
        console.warn('[machines] attachCustomerCodes:', error);
        return rows;
    }

    const codeByLabel = buildCustomerFieldByLabelMap(customers, 'code');
    /** @type {Record<string, string>} */
    const codeById = {};
    (customers || []).forEach((customer) => {
        if (customer?.id && customer?.code) {
            codeById[customer.id] = String(customer.code).trim();
        }
    });

    return rows.map((machine) => {
        if (String(machine.customer_code || '').trim()) return machine;
        const label = String(machine.customer_name || '').trim();
        if (!label) return machine;

        let code = resolveCustomerFieldFromMachineLabel(label, codeByLabel);
        if (!code && machine.customer_id && codeById[machine.customer_id]) {
            code = codeById[machine.customer_id];
        }

        return code ? { ...machine, customer_code: code } : machine;
    });
}

/**
 * Gắn kho từ hồ sơ KH (warehouse_id) hoặc đơn hoàn thành — khớp tên cơ sở, đại diện, v.v.
 */
export async function attachCustomerWarehousesToMachines(supabaseClient, machineRows) {
    const rows = machineRows || [];
    const needsWarehouse = rows.some((m) => {
        const cust = String(m.customer_name || '').trim();
        const wh = String(m.warehouse || m.customer_warehouse || '').trim();
        return cust && !wh;
    });
    if (!needsWarehouse) return attachCustomerCodesToMachines(supabaseClient, rows);

    const { data: customers, error: custErr } = await supabaseClient
        .from('customers')
        .select('id, name, legal_rep, warehouse_id, invoice_company_name')
        .not('warehouse_id', 'is', null);

    if (custErr) {
        console.warn('[machines] attachCustomerWarehouses customers:', custErr);
    }

    /** @type {Record<string, string>} */
    const whByLabelKey = {};
    (customers || []).forEach((c) => {
        const wh = String(c.warehouse_id || '').trim();
        if (!wh) return;
        [c.name, c.legal_rep, c.invoice_company_name].forEach((field) => {
            const key = normalizeCustomerLookupKey(field);
            if (key) whByLabelKey[key] = wh;
        });
    });

    /** @type {{ row: Record<string, unknown>; label: string }[]} */
    const stillMissing = [];

    let result = rows.map((m) => {
        const label = String(m.customer_name || '').trim();
        if (!label) return m;
        if (String(m.warehouse || m.customer_warehouse || '').trim()) return m;

        const wh = whByLabelKey[normalizeCustomerLookupKey(label)];
        if (!wh) {
            stillMissing.push({ row: m, label });
            return m;
        }
        return {
            ...m,
            customer_warehouse: wh,
        };
    });

    for (const { row, label } of stillMissing) {
        const esc = label
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_')
            .replace(/,/g, '');
        const ilikeVal = `%${esc}%`;

        let wh = '';

        const { data: byRep } = await supabaseClient
            .from('customers')
            .select('warehouse_id, legal_rep')
            .ilike('legal_rep', ilikeVal)
            .not('warehouse_id', 'is', null)
            .limit(3);
        const repMatch = (byRep || []).find(
            (c) => normalizeCustomerLookupKey(c.legal_rep) === normalizeCustomerLookupKey(label),
        );
        if (repMatch?.warehouse_id) {
            wh = String(repMatch.warehouse_id).trim();
        }

        if (!wh) {
            const { data: orders, error: ordErr } = await supabaseClient
                .from('orders')
                .select(
                    'warehouse, note, status, created_at, customer_id, customer_name, recipient_name, order_type, order_code',
                )
                .or(`customer_name.ilike.${ilikeVal},recipient_name.ilike.${ilikeVal}`)
                .order('created_at', { ascending: false })
                .limit(40);

            if (ordErr) {
                console.warn('[machines] attachCustomerWarehouses orders:', ordErr);
                continue;
            }

            const completed = (orders || []).filter((o) => isOrderDeliveredCompleted(o.status));
            const order = completed[0];
            if (order) {
                /** @type {Record<string, string>} */
                const customerWarehouseById = {};
                if (order.customer_id) {
                    const { data: custRow } = await supabaseClient
                        .from('customers')
                        .select('warehouse_id')
                        .eq('id', order.customer_id)
                        .maybeSingle();
                    if (custRow?.warehouse_id) {
                        customerWarehouseById[order.customer_id] = String(custRow.warehouse_id).trim();
                    }
                }
                wh = resolveOrderWarehouseForMachine(order, customerWarehouseById);
            }
        }

        if (!wh) continue;

        result = result.map((m) => {
            if (m.id !== row.id) return m;
            return {
                ...m,
                customer_warehouse: m.customer_warehouse || wh,
                warehouse: m.warehouse || wh,
            };
        });
    }

    return attachCustomerCodesToMachines(supabaseClient, result);
}
