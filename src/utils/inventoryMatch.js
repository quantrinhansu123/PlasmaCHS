import { PRODUCT_TYPES } from '../constants/orderConstants';
import { resolveWarehouseRow, warehouseStorageKeys } from './transferWarehouseMatch';

/** Các khóa warehouse_id có thể lưu trong bảng inventory (mã, UUID, tên). */
export function getInventoryWarehouseKeys(warehouseRef, warehouseList = []) {
    const ref = String(warehouseRef || '').trim();
    if (!ref) return [];

    const keys = new Set([ref]);
    const whRow = resolveWarehouseRow(ref, warehouseList);
    if (whRow) {
        warehouseStorageKeys(whRow).forEach((k) => keys.add(k));
    }
    return [...keys];
}

const normalizeItemText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

/** Khớp dòng inventory với loại sản phẩm đơn (BINH_4L, BINH_8L…). */
export function inventoryRowMatchesProduct(row, productType) {
    if (!row || !productType) return false;

    const rowType = String(row.item_type || '').trim().toUpperCase();
    const targetType = String(productType || '').trim().toUpperCase();
    const itemName = normalizeItemText(row.item_name);

    if (rowType === targetType) return true;
    if (rowType.startsWith('BINH') && targetType.startsWith('BINH')) {
        if (targetType === 'BINH_4L') {
            if (itemName.includes('binh 4l') || itemName.includes('bình 4l')) return true;
            if (/\b4\s*l/.test(itemName) && !itemName.includes('40l') && !itemName.includes('14l')) return true;
        }
        if (targetType === 'BINH_8L') {
            return itemName.includes('8l') || itemName.includes('8 l');
        }
        if (targetType === 'BINH') return true;
    }

    const label = PRODUCT_TYPES.find((p) => p.id === productType)?.label;
    if (label && itemName.includes(normalizeItemText(label))) return true;

    return false;
}

/**
 * Tìm dòng tồn kho tổng hợp — thử mọi biến thể mã kho và khớp tên/loại linh hoạt.
 */
export async function findInventoryLine(supabaseClient, { warehouseRef, warehouseList = [], productType }) {
    const whKeys = getInventoryWarehouseKeys(warehouseRef, warehouseList);
    if (!whKeys.length) return { data: null, error: null };

    let lastError = null;

    for (const whKey of whKeys) {
        const { data: rows, error } = await supabaseClient
            .from('inventory')
            .select('id, quantity, item_name, item_type, warehouse_id')
            .eq('warehouse_id', whKey);

        if (error) {
            lastError = error;
            continue;
        }
        if (!rows?.length) continue;

        const matched = rows.find((row) => inventoryRowMatchesProduct(row, productType));
        if (matched) return { data: matched, error: null };
    }

    return { data: null, error: lastError };
}

const cylinderVolumeMatchesProduct = (volume, productType) => {
    const raw = String(volume ?? '').trim();
    const vol = raw.toLowerCase();
    const compact = vol.replace(/\s+/g, '');

    if (productType === 'BINH_4L') {
        if (!vol) return false;
        if (/\b40\s*l(ít|$|\/|,|\))/i.test(vol) || compact.includes('40l')) return false;
        if (/\b(14|24|34|143)\s*l\b/i.test(vol)) return false;
        if (/bình\s*4\s*l|binh\s*4\s*l/i.test(vol)) return true;
        if (/\b4\s*l(ít|$|\/|,|\)|\s|cga)/i.test(vol)) return true;
        return compact.includes('4l');
    }
    if (productType === 'BINH_8L') {
        return vol.includes('8l') || vol.includes('8 l');
    }
    if (productType?.startsWith('BINH')) return true;
    return false;
};

const isReadyCylinderStatus = (status) => {
    const s = normalizeItemText(status);
    return s === 'san sang' || s.includes('san sang');
};

/**
 * Khi chưa có dòng inventory nhưng kho có bình RFID — tạo/cập nhật dòng tồn từ đếm thực tế.
 */
export async function ensureInventoryLineFromCylinders(
    supabaseClient,
    { warehouseRef, warehouseList = [], productType },
) {
    const whRow = resolveWarehouseRow(warehouseRef, warehouseList);
    const cylWarehouseIds = [...new Set([whRow?.id, warehouseRef].filter(Boolean))];

    let readyCount = 0;
    for (const whId of cylWarehouseIds) {
        const { data: cylinders, error } = await supabaseClient
            .from('cylinders')
            .select('id, volume, status, warehouse_id')
            .eq('warehouse_id', whId);

        if (error) throw error;

        readyCount += (cylinders || []).filter(
            (c) => isReadyCylinderStatus(c.status) && cylinderVolumeMatchesProduct(c.volume, productType),
        ).length;
    }

    if (readyCount <= 0) return { data: null, error: null };

    const productLabel = PRODUCT_TYPES.find((p) => p.id === productType)?.label || productType;
    const insertWarehouseId = whRow?.id || whRow?.code || warehouseRef;
    const itemType = String(productType || '').startsWith('BINH') ? productType : 'BINH';

    const { data: existing } = await findInventoryLine(supabaseClient, {
        warehouseRef,
        warehouseList,
        productType,
    });

    if (existing) {
        if ((existing.quantity || 0) < readyCount) {
            const { data: updated, error: updErr } = await supabaseClient
                .from('inventory')
                .update({ quantity: readyCount, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select('id, quantity, item_name, item_type, warehouse_id')
                .single();
            if (updErr) throw updErr;
            return { data: updated, error: null };
        }
        return { data: existing, error: null };
    }

    const { data: created, error: insErr } = await supabaseClient
        .from('inventory')
        .insert({
            warehouse_id: insertWarehouseId,
            item_type: itemType,
            item_name: productLabel,
            quantity: readyCount,
        })
        .select('id, quantity, item_name, item_type, warehouse_id')
        .single();

    if (insErr) throw insErr;
    return { data: created, error: null };
}

export async function resolveInventoryLineForOrder(
    supabaseClient,
    { warehouseRef, warehouseList = [], productType, allowCylinderSync = true },
) {
    const { data: found, error } = await findInventoryLine(supabaseClient, {
        warehouseRef,
        warehouseList,
        productType,
    });
    if (error) throw error;
    if (found) return found;

    if (!allowCylinderSync || !String(productType || '').startsWith('BINH')) {
        return null;
    }

    const { data: synced, error: syncErr } = await ensureInventoryLineFromCylinders(supabaseClient, {
        warehouseRef,
        warehouseList,
        productType,
    });
    if (syncErr) throw syncErr;
    return synced;
}
