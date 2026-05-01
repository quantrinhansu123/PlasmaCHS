/**
 * Mã máy gắn với đơn (xuất kho / giao) — dùng chung Đơn hàng và Nhiệm vụ giao hàng.
 * Không chỉ dựa orders.department vì đơn đa dòng có serial trong order_items và checklist MAY:...
 */

/** Khách hiển thị trên máy/bình: ưu tiên customer_name đơn, fallback người nhận */
export function resolvedOrderCustomerAssetName(order) {
    const a = String(order?.customer_name || '').trim();
    const b = String(order?.recipient_name || '').trim();
    return a || b || null;
}

export function isMachineProductType(productType) {
    if (!productType) return false;
    const normalized = String(productType).trim();
    const u = normalized.toUpperCase();
    if (u.startsWith('MAY') || normalized.startsWith('MÁY')) return true;
    return ['TM', 'SD', 'FM', 'Khac', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED', 'MAY_MED_NEW'].includes(
        normalized,
    );
}

/**
 * @param deliveryChecklist object — key dạng MAY:<serial>; có mặt key là được gộp (logic giống OrderStatusUpdater).
 */
export function collectMachineSerialsForOrder(order, orderItems, deliveryChecklist) {
    const serials = new Set();
    (orderItems || []).forEach((it) => {
        if (!isMachineProductType(it?.product_type)) return;
        const sn = String(it.serial_number || '').trim();
        if (sn) serials.add(sn);
    });
    String(order?.department || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => serials.add(s));
    const note = order?.note || '';
    const sectionIdx = note.indexOf('=== MÁY ĐÃ GÁN TỪ KHO ===');
    if (sectionIdx !== -1) {
        const lines = note.slice(sectionIdx).split('\n');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('===')) break;
            const m = line.match(/^\d+\)\s*Mã:\s*(.+)$/i);
            if (m?.[1]) serials.add(m[1].trim());
        }
    }
    if (deliveryChecklist && typeof deliveryChecklist === 'object') {
        Object.keys(deliveryChecklist).forEach((key) => {
            if (!String(key).startsWith('MAY:')) return;
            const sn = String(key).slice(4).trim();
            if (sn) serials.add(sn);
        });
    }
    return [...serials];
}
