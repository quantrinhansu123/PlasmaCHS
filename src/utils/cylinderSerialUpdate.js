import { CYLINDER_KHO_COLUMN, CYLINDER_WAREHOUSE_LEGACY_COLUMN } from './cylinderKho';
import {
    getOrderCylinderExportSerials,
} from './orderCylinderExport';

/** Gom mọi mã bình trên đơn khi xác nhận giao thành công. */
export function collectDeliveredCylinderSerials(order, orderItems = [], deliveryChecklist = {}) {
    const serials = new Set();

    getOrderCylinderExportSerials(order, orderItems, '').forEach((sn) => serials.add(sn));

    (order?.assigned_cylinders || []).forEach((s) => {
        const sn = String(typeof s === 'string' ? s : s?.serial || '').trim();
        if (sn) serials.add(sn);
    });

    const checklist = deliveryChecklist && typeof deliveryChecklist === 'object' ? deliveryChecklist : {};
    Object.keys(checklist).forEach((key) => {
        if (!String(key).startsWith('BINH:')) return;
        const sn = String(key).slice(5).trim();
        if (sn) serials.add(sn);
    });

    (orderItems || []).forEach((it) => {
        if (!String(it?.product_type || '').startsWith('BINH')) return;
        (it.assigned_cylinders || []).forEach((s) => {
            const sn = String(typeof s === 'string' ? s : s?.serial || '').trim();
            if (sn) serials.add(sn);
        });
        const lineSn = String(it.serial_number || '').trim();
        if (lineSn) serials.add(lineSn);
    });

    return [...serials];
}

/** Lấy bản ghi bình theo serial — khớp không phân biệt hoa thường. */
export async function fetchCylindersBySerials(
    supabaseClient,
    serials,
    select = 'id, serial_number, volume, status',
) {
    const requested = [...new Set(
        (serials || []).map((s) => String(s || '').trim()).filter(Boolean),
    )];
    const rows = [];

    for (const sn of requested) {
        const { data, error } = await supabaseClient
            .from('cylinders')
            .select(select)
            .ilike('serial_number', sn)
            .maybeSingle();
        if (error) throw error;
        if (data) rows.push(data);
    }

    return rows;
}

/** Cập nhật bình theo serial — khớp không phân biệt hoa thường. */
export async function updateCylindersBySerials(supabaseClient, serials, fields) {
    const requested = [...new Set(
        (serials || []).map((s) => String(s || '').trim()).filter(Boolean),
    )];
    if (!requested.length) return { updated: 0, requested: 0, missing: [] };

    const missing = [];
    let updated = 0;

    for (const sn of requested) {
        const { data: row, error: fetchErr } = await supabaseClient
            .from('cylinders')
            .select('id, serial_number')
            .ilike('serial_number', sn)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!row?.id) {
            missing.push(sn);
            continue;
        }

        const { error: upErr } = await supabaseClient
            .from('cylinders')
            .update({
                ...fields,
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        if (upErr) throw upErr;
        updated += 1;
    }

    return { updated, requested: requested.length, missing };
}

/** Chuyển bình sang trạng thái thuộc khách hàng sau giao hàng. */
export async function markCylindersDeliveredToCustomer(
    supabaseClient,
    serials,
    { customerName, customerId } = {},
) {
    const result = await updateCylindersBySerials(supabaseClient, serials, {
        status: 'thuộc khách hàng',
        customer_name: customerName || null,
        customer_id: customerId || null,
        [CYLINDER_KHO_COLUMN]: null,
        [CYLINDER_WAREHOUSE_LEGACY_COLUMN]: null,
    });

    if (result.missing.length > 0) {
        throw new Error(`Không tìm thấy mã bình: ${result.missing.join(', ')}`);
    }
    if (result.updated === 0 && result.requested > 0) {
        throw new Error('Không cập nhật được trạng thái bình sau giao hàng.');
    }

    return result;
}
