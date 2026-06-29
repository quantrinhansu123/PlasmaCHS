import { PRODUCT_TYPES } from '../constants/orderConstants';
import { CYLINDER_KHO_COLUMN, CYLINDER_WAREHOUSE_LEGACY_COLUMN } from './orderWarehouseScope';
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

export const cylinderVolumeMatchesProduct = (volume, productType) => {
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

const BINH_PRODUCT_TYPES = ['BINH_4L', 'BINH_8L', 'BINH'];

function buildCylinderWarehouseKeys(warehouseRef, warehouseList = []) {
    const whRow = resolveWarehouseRow(warehouseRef, warehouseList);
    return [...new Set([
        ...(whRow ? [whRow.code, whRow.name, whRow.id].map((v) => String(v || '').trim()).filter(Boolean) : []),
        String(warehouseRef || '').trim(),
    ].filter(Boolean))];
}

/** Đếm bình sẵn sàng tại kho theo loại sản phẩm (BINH_4L, BINH_8L…). */
export async function countReadyCylindersAtWarehouseByProduct(
    supabaseClient,
    { warehouseRef, warehouseList = [] } = {},
) {
    const counts = Object.fromEntries(BINH_PRODUCT_TYPES.map((pt) => [pt, 0]));
    const cylWarehouseKeys = buildCylinderWarehouseKeys(warehouseRef, warehouseList);
    if (!cylWarehouseKeys.length) return counts;

    const { data: cylinders, error } = await supabaseClient
        .from('cylinders')
        .select(`volume, status, ${CYLINDER_KHO_COLUMN}`)
        .in(CYLINDER_KHO_COLUMN, cylWarehouseKeys);

    if (error) throw error;

    for (const cylinder of cylinders || []) {
        if (!isReadyCylinderStatus(cylinder.status)) continue;
        for (const productType of BINH_PRODUCT_TYPES) {
            if (cylinderVolumeMatchesProduct(cylinder.volume, productType)) {
                counts[productType] += 1;
                break;
            }
        }
    }

    return counts;
}

/**
 * Đồng bộ quantity trên bảng inventory = số bình thực tế đang «sẵn sàng» tại kho.
 */
export async function syncBinhInventoryFromReadyCylinders(
    supabaseClient,
    { warehouseRef, warehouseList = [] } = {},
) {
    const whRow = resolveWarehouseRow(warehouseRef, warehouseList);
    const storageWarehouseId = whRow?.id || whRow?.code || warehouseRef;
    if (!storageWarehouseId) return { updated: 0 };

    const counts = await countReadyCylindersAtWarehouseByProduct(supabaseClient, {
        warehouseRef,
        warehouseList,
    });

    let updated = 0;

    for (const productType of BINH_PRODUCT_TYPES) {
        const readyCount = counts[productType] || 0;
        const productLabel = PRODUCT_TYPES.find((p) => p.id === productType)?.label || productType;

        const { data: existing } = await findInventoryLine(supabaseClient, {
            warehouseRef,
            warehouseList,
            productType,
        });

        if (existing?.id) {
            if ((existing.quantity || 0) !== readyCount) {
                const { error: updErr } = await supabaseClient
                    .from('inventory')
                    .update({ quantity: readyCount, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                if (updErr) throw updErr;
                updated += 1;
            }
            continue;
        }

        if (readyCount <= 0) continue;

        const { error: insErr } = await supabaseClient.from('inventory').insert({
            warehouse_id: storageWarehouseId,
            item_type: productType,
            item_name: productLabel,
            quantity: readyCount,
        });
        if (insErr) throw insErr;
        updated += 1;
    }

    return { updated };
}

const OFF_WAREHOUSE_CYLINDER_STATUSES = [
    'thuộc khách hàng',
    'đang sử dụng',
    'đã sử dụng',
    'đang vận chuyển',
    'đã trả ncc',
];

/** Xóa kho trên bình không còn nằm tại kho (đã giao, đang vận chuyển…). */
export async function repairOffWarehouseCylinderKho(supabaseClient) {
    const { data, error } = await supabaseClient
        .from('cylinders')
        .update({
            [CYLINDER_KHO_COLUMN]: null,
            [CYLINDER_WAREHOUSE_LEGACY_COLUMN]: null,
            updated_at: new Date().toISOString(),
        })
        .in('status', OFF_WAREHOUSE_CYLINDER_STATUSES)
        .or(`${CYLINDER_KHO_COLUMN}.not.is.null,${CYLINDER_WAREHOUSE_LEGACY_COLUMN}.not.is.null`)
        .select('id');

    if (error) throw error;
    return { clearedKho: data?.length || 0 };
}

/** Bình vẫn «sẵn sàng» nhưng đã gán khách → chuyển thuộc khách hàng, xóa kho. */
export async function repairReadyCylindersWithCustomer(supabaseClient) {
    const { data, error } = await supabaseClient
        .from('cylinders')
        .update({
            status: 'thuộc khách hàng',
            [CYLINDER_KHO_COLUMN]: null,
            [CYLINDER_WAREHOUSE_LEGACY_COLUMN]: null,
            updated_at: new Date().toISOString(),
        })
        .eq('status', 'sẵn sàng')
        .not('customer_name', 'is', null)
        .neq('customer_name', '')
        .select('id, serial_number');

    if (error) throw error;
    return { fixedCustomerReady: data?.length || 0 };
}

/** Đồng bộ tồn BINH trên mọi kho từ số bình sẵn sàng thực tế. */
export async function syncAllBinhInventoryFromReadyCylinders(supabaseClient) {
    const { data: warehouses, error } = await supabaseClient
        .from('warehouses')
        .select('id, name, code, branch_office')
        .order('name');

    if (error) throw error;

    let inventoryLinesUpdated = 0;
    const warehouseDetails = [];

    for (const wh of warehouses || []) {
        const warehouseRef = wh.code || wh.id || wh.name;
        const { updated } = await syncBinhInventoryFromReadyCylinders(supabaseClient, {
            warehouseRef,
            warehouseList: warehouses || [],
        });
        if (updated > 0) {
            inventoryLinesUpdated += updated;
            warehouseDetails.push({ warehouse: wh.name || warehouseRef, updated });
        }
    }

    return {
        inventoryLinesUpdated,
        warehouseDetails,
        warehouseCount: (warehouses || []).length,
    };
}

/** Sửa dữ liệu bình lệch + đồng bộ tồn sẵn sàng toàn hệ thống. */
export async function repairAndSyncAllBinhInventory(supabaseClient) {
    const khoResult = await repairOffWarehouseCylinderKho(supabaseClient);
    const customerResult = await repairReadyCylindersWithCustomer(supabaseClient);
    const syncResult = await syncAllBinhInventoryFromReadyCylinders(supabaseClient);

    return {
        ...khoResult,
        ...customerResult,
        ...syncResult,
    };
}

/**
 * Khi chưa có dòng inventory nhưng kho có bình RFID — tạo/cập nhật dòng tồn từ đếm thực tế.
 */
export async function ensureInventoryLineFromCylinders(
    supabaseClient,
    { warehouseRef, warehouseList = [], productType },
) {
    const whRow = resolveWarehouseRow(warehouseRef, warehouseList);
    const cylWarehouseKeys = [...new Set([
        ...(whRow ? [whRow.code, whRow.name, whRow.id].map((v) => String(v || '').trim()).filter(Boolean) : []),
        String(warehouseRef || '').trim(),
    ].filter(Boolean))];

    let readyCount = 0;
    if (cylWarehouseKeys.length > 0) {
        const { data: cylinders, error } = await supabaseClient
            .from('cylinders')
            .select(`id, volume, status, ${CYLINDER_KHO_COLUMN}`)
            .in(CYLINDER_KHO_COLUMN, cylWarehouseKeys);

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
        if ((existing.quantity || 0) !== readyCount) {
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
