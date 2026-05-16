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

/** Tên cơ sở / phòng trên đơn — không dùng orders.department khi đó là danh sách mã máy (ĐNXM). */
export function getOrderFacilityRoomLabel(order) {
    const recipient = String(order?.recipient_name || '').trim();
    if (recipient) return recipient;

    const dept = String(order?.department || '').trim();
    if (!dept) return '';

    if (String(order?.order_code || '').startsWith('DNXM-')) {
        return '';
    }

    if (dept.includes(',')) {
        return '';
    }

    return dept;
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

const CORE_MACHINE_TYPES = new Set(['TM', 'SD', 'FM']);

export function normalizeMachineTypeKey(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'KHÁC' || raw === 'KHAC' || raw.startsWith('KHAC')) return 'KHAC';
    return raw;
}

/** Loại máy yêu cầu trên đơn (TM/SD/FM/Khac/...) từ product_type và ghi chú ĐNXM. */
export function getOrderMachineTypeFilter(order, orderItems = []) {
    const keys = new Set();

    const addKey = (value) => {
        const key = normalizeMachineTypeKey(value);
        if (!key || key === 'MAY' || key === 'DNXM' || key.startsWith('MAY_')) return;
        keys.add(key);
    };

    (orderItems || []).forEach((item) => {
        if (!isMachineProductType(item?.product_type)) return;
        addKey(item.product_type);
    });

    if (isMachineProductType(order?.product_type)) addKey(order.product_type);
    if (isMachineProductType(order?.product_type_2)) addKey(order.product_type_2);

    const note = String(order?.note || '');
    const machineTypeLine = note.match(/Loại máy:\s*([^\n.]+)/i);
    if (machineTypeLine?.[1]) {
        machineTypeLine[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach(addKey);
    }

    const productLine = note.match(/Sản phẩm:\s*([^\n.]+)/i);
    if (productLine?.[1]) {
        const product = productLine[1].trim();
        if (product) addKey(product);
    }

    return [...keys];
}

export function machineMatchesOrderTypeFilter(machineType, filterKeys = []) {
    if (!Array.isArray(filterKeys) || filterKeys.length === 0) return true;

    const machineKey = normalizeMachineTypeKey(machineType);
    const normalizedFilters = filterKeys.map(normalizeMachineTypeKey).filter(Boolean);

    if (normalizedFilters.includes('KHAC')) {
        if (!CORE_MACHINE_TYPES.has(machineKey)) return true;
        if (normalizedFilters.length === 1) return false;
    }

    return normalizedFilters.some((filterKey) => {
        if (filterKey === 'KHAC') {
            return !CORE_MACHINE_TYPES.has(machineKey);
        }
        return filterKey === machineKey;
    });
}

export function formatOrderMachineTypeFilterLabel(filterKeys = []) {
    if (!filterKeys?.length) return '';
    return filterKeys
        .map((key) => (normalizeMachineTypeKey(key) === 'KHAC' ? 'Khác' : normalizeMachineTypeKey(key)))
        .join(', ');
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
