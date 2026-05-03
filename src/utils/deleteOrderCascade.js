/**
 * Xóa đơn hàng và hoàn tác tác động phụ đã biết trong app:
 * - inventory_transactions.reference_id → cộng/trừ lại quantity trên inventory, rồi xóa log
 * - cylinders: các mã bình gắn đơn → sẵn sàng (bỏ gán khách)
 * - machines: các mã máy gắn đơn → sẵn sàng, gán lại warehouse theo đơn
 * - cylinder_logs: xóa dòng có mô tả tham chiếu mã đơn (lịch sử gắn với đơn)
 * - order_items → orders
 */

import { collectMachineSerialsForOrder } from './orderMachineSerials';

function normalizeDeliveryChecklist(dc) {
    if (dc == null) return {};
    if (typeof dc === 'string') {
        try {
            return JSON.parse(dc);
        } catch {
            return {};
        }
    }
    if (typeof dc === 'object' && !Array.isArray(dc)) return dc;
    return {};
}

function collectCylinderSerialsFromOrderPayload(order, orderItems) {
    const out = [];
    const pushScalar = (s) => {
        const v = String(s || '').trim();
        if (v) out.push(v);
    };
    const pushArr = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((entry) => {
            if (typeof entry === 'string') pushScalar(entry);
            else if (entry && typeof entry === 'object') pushScalar(entry.serial ?? entry.rfid ?? entry.code);
        });
    };

    pushArr(order?.assigned_cylinders);
    (orderItems || []).forEach((it) => {
        pushArr(it?.assigned_cylinders);
        const pt = String(it?.product_type || '').toUpperCase();
        if (pt.includes('BINH') || pt === 'BINH' || pt === 'BINH_4L' || pt === 'BINH_8L') {
            pushScalar(it?.serial_number);
        }
    });

    const chk = normalizeDeliveryChecklist(order?.delivery_checklist);
    Object.keys(chk).forEach((key) => {
        const k = String(key).trim();
        if (/^BINH:/i.test(k)) pushScalar(k.replace(/^BINH:/i, '').trim());
        else if (/^BINH\s+/i.test(k)) pushScalar(k.replace(/^BINH\s+/i, '').trim());
    });

    return [...new Set(out)];
}

async function deleteCylinderLogsForOrderCode(supabase, orderCode) {
    const code = String(orderCode || '').trim();
    if (!code) return;

    const pattern = `%Đơn ${code}%`;
    const { error } = await supabase.from('cylinder_logs').delete().ilike('description', pattern);
    if (error) {
        console.warn('[deleteOrderCascade] cylinder_logs cleanup:', error.message);
    }
}

/**
 * Xóa một đơn và rollback dữ liệu liên quan.
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
async function deleteOneOrderWithRollback(supabase, orderId) {
    const { data: row, error: fetchErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .maybeSingle();

    if (fetchErr) {
        return { ok: false, error: fetchErr.message };
    }
    if (!row) {
        return { ok: true, skipped: true };
    }

    const orderItems = row.order_items || [];

    const { data: txns, error: txErr } = await supabase
        .from('inventory_transactions')
        .select('id, inventory_id, transaction_type, quantity_changed')
        .eq('reference_id', orderId);

    if (txErr) {
        return { ok: false, error: txErr.message };
    }

    for (const t of txns || []) {
        const qty = Math.abs(parseInt(String(t.quantity_changed), 10) || 0);
        const invId = t.inventory_id;
        if (!invId || qty <= 0) continue;

        const { data: inv, error: invErr } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('id', invId)
            .maybeSingle();

        if (invErr) {
            return { ok: false, error: invErr.message };
        }
        if (!inv) continue;

        let nextQty = inv.quantity;
        if (t.transaction_type === 'OUT') {
            nextQty = (parseInt(inv.quantity, 10) || 0) + qty;
        } else if (t.transaction_type === 'IN') {
            nextQty = Math.max(0, (parseInt(inv.quantity, 10) || 0) - qty);
        }

        const { error: updErr } = await supabase
            .from('inventory')
            .update({ quantity: nextQty, updated_at: new Date().toISOString() })
            .eq('id', inv.id);
        if (updErr) {
            return { ok: false, error: updErr.message };
        }
    }

    const { error: delTxErr } = await supabase.from('inventory_transactions').delete().eq('reference_id', orderId);
    if (delTxErr) {
        return { ok: false, error: delTxErr.message };
    }

    const cylSerials = collectCylinderSerialsFromOrderPayload(row, orderItems);
    if (cylSerials.length > 0) {
        const { error: cylErr } = await supabase
            .from('cylinders')
            .update({
                status: 'sẵn sàng',
                customer_name: null,
                updated_at: new Date().toISOString(),
            })
            .in('serial_number', cylSerials);

        if (cylErr) {
            return { ok: false, error: cylErr.message };
        }
    }

    const checklist = normalizeDeliveryChecklist(row.delivery_checklist);
    const machineSerials = collectMachineSerialsForOrder(row, orderItems, checklist);
    if (machineSerials.length > 0) {
        const wh = row.warehouse || null;
        const { error: machErr } = await supabase
            .from('machines')
            .update({
                status: 'sẵn sàng',
                customer_name: null,
                warehouse: wh,
                updated_at: new Date().toISOString(),
            })
            .in('serial_number', machineSerials);

        if (machErr) {
            return { ok: false, error: machErr.message };
        }
    }

    await deleteCylinderLogsForOrderCode(supabase, row.order_code);

    const { error: oiErr } = await supabase.from('order_items').delete().eq('order_id', orderId);
    if (oiErr) {
        return { ok: false, error: oiErr.message };
    }

    const { error: ordErr } = await supabase.from('orders').delete().eq('id', orderId);
    if (ordErr) {
        return { ok: false, error: ordErr.message };
    }

    return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} orderIds
 * @returns {Promise<{ deleted: number; failed: { orderId: string; message: string }[] }>}
 */
export async function deleteOrdersWithRollback(supabase, orderIds) {
    const ids = [...new Set((orderIds || []).filter(Boolean))];
    const failed = [];
    let deleted = 0;

    for (const orderId of ids) {
        const result = await deleteOneOrderWithRollback(supabase, orderId);
        if (!result.ok) {
            failed.push({ orderId, message: result.error || 'Lỗi không xác định' });
            continue;
        }
        if (!result.skipped) {
            deleted += 1;
        }
    }

    return { deleted, failed };
}
