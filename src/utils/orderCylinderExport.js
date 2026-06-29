/**
 * Số lượng / serial bình trên đơn — hỗ trợ cả order_items và cột legacy trên orders.
 */

export function getOrderCylinderLineItems(order, orderItems = []) {
    const lines = (orderItems || []).filter((it) => String(it?.product_type || '').startsWith('BINH'));
    if (lines.length > 0) return lines;

    const legacy = [];
    if (String(order?.product_type || '').startsWith('BINH')) {
        legacy.push({
            product_type: order.product_type,
            quantity: parseInt(order.quantity, 10) || 0,
            assigned_cylinders: order.assigned_cylinders,
        });
    }
    if (String(order?.product_type_2 || '').startsWith('BINH')) {
        legacy.push({
            product_type: order.product_type_2,
            quantity: parseInt(order.quantity_2, 10) || 0,
            assigned_cylinders: null,
        });
    }
    return legacy.filter((line) => (parseInt(line.quantity, 10) || 0) > 0);
}

export function getOrderCylinderExportQuantity(order, orderItems = []) {
    return getOrderCylinderLineItems(order, orderItems).reduce(
        (sum, line) => sum + (parseInt(line.quantity, 10) || 0),
        0,
    );
}

/** Ưu tiên mã quét tại kho; fallback mã đã gán trên đơn / order_items. */
export function getOrderCylinderExportSerials(order, orderItems = [], scannedSerials = '') {
    const fromScan = String(scannedSerials || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (fromScan.length > 0) return fromScan;

    const serials = [];
    const add = (value) => {
        const sn = String(value || '').trim();
        if (sn) serials.push(sn);
    };

    (order?.assigned_cylinders || []).forEach((s) => add(typeof s === 'string' ? s : s?.serial));

    getOrderCylinderLineItems(order, orderItems).forEach((line) => {
        const assigned = line.assigned_cylinders;
        if (Array.isArray(assigned)) {
            assigned.forEach((s) => add(typeof s === 'string' ? s : s?.serial));
        }
        add(line.serial_number);
    });

    return [...new Set(serials)];
}
