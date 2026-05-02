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

export function resolveOrderCustomerDisplay(order, customersById = {}) {
    if (!order) return '';
    const cid = order.customer_id;
    if (cid && customersById[cid]?.name) return String(customersById[cid].name).trim();
    return String(order.customer_name || order.recipient_name || '').trim();
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
