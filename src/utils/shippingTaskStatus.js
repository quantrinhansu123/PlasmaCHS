/** Trạng thái đơn còn trong luồng giao — dùng query Supabase (.in). */
export const ORDER_STATUSES_SHIPPING_PIPELINE = [
    'KHO_XU_LY',
    'DA_DUYET',
    'CHO_GIAO_HANG',
    'DANG_GIAO_HANG',
    'CHO_DOI_SOAT',
    'DOI_SOAT_THAT_BAI',
    'TRA_HANG',
];

const normalizeStatusKey = (status) =>
    String(status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .trim()
        .toUpperCase();

/** Đơn đã kết thúc — không hiện trên màn nhiệm vụ giao. */
export function isTerminalShippingOrderStatus(status) {
    const key = normalizeStatusKey(status);
    if (!key) return false;
    if (key === 'HOANTHANH' || key === 'HUY' || key === 'HUYDON') return true;
    if (key.includes('TUCHOI') || key.includes('TU_CHOI')) return true;
    return false;
}

export function isShippingPipelineOrderStatus(status) {
    if (isTerminalShippingOrderStatus(status)) return false;
    const key = normalizeStatusKey(status);
    if (!key) return false;
    const pipelineKeys = new Set(
        ORDER_STATUSES_SHIPPING_PIPELINE.map((s) => normalizeStatusKey(s)),
    );
    if (pipelineKeys.has(key)) return true;
    if (key.includes('GIAOHANG') && !key.includes('HOANTHANH')) return true;
    if (key.includes('DOISOAT')) return true;
    return false;
}

const normalizePersonKey = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

export function deliveryUnitMatchesShipper(deliveryUnit, shipperKey) {
    const du = normalizePersonKey(deliveryUnit);
    const sk = normalizePersonKey(shipperKey);
    if (!sk) return false;
    if (!du) return false;
    return du === sk || du.includes(sk) || sk.includes(du);
}

/** Trạng thái được bấm «Giao hàng» / mở modal xác nhận giao trên màn nhiệm vụ. */
export const ORDER_STATUSES_CAN_CONFIRM_DELIVERY = [
    'KHO_XU_LY',
    'DA_DUYET',
    'CHO_GIAO_HANG',
    'DANG_GIAO_HANG',
];

export function canOpenShippingDeliveryConfirm(status) {
    if (isTerminalShippingOrderStatus(status)) return false;
    const key = normalizeStatusKey(status);
    const allowed = new Set(
        ORDER_STATUSES_CAN_CONFIRM_DELIVERY.map((s) => normalizeStatusKey(s)),
    );
    return allowed.has(key);
}
