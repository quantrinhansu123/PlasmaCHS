import { toast } from 'react-toastify';
import { notificationService } from './notificationService';

/**
 * Cập nhật bình, khách (borrowed_cylinders), tồn kho khi phiếu thu hồi chốt Hoàn thành.
 * Gọi sau khi đã lưu recovery + cylinder_recovery_items (modal) hoặc sau khi UPDATE status (quick).
 */
export async function applyRecoveryCompletionInventory(supabase, {
    recoveryId,
    recoveryCode,
    customerId,
    customerName,
    warehouseId,
    items,
}) {
    const serialNumbers = (items || []).map((i) => i.serial_number).filter(Boolean);
    if (serialNumbers.length === 0) return;

    const { data: cylindersData } = await supabase
        .from('cylinders')
        .select('serial_number, volume')
        .in('serial_number', serialNumbers);

    for (const serial of serialNumbers) {
        await supabase
            .from('cylinders')
            .update({
                status: 'bình rỗng',
                warehouse_id: warehouseId,
                customer_id: null,
                customer_name: null,
                updated_at: new Date().toISOString(),
            })
            .eq('serial_number', serial);
    }

    const { data: customerData } = await supabase
        .from('customers')
        .select('borrowed_cylinders')
        .eq('id', customerId)
        .single();
    if (customerData) {
        const n = serialNumbers.length;
        const newBorrowed = Math.max(0, (customerData.borrowed_cylinders || 0) - n);
        await supabase
            .from('customers')
            .update({ borrowed_cylinders: newBorrowed, updated_at: new Date().toISOString() })
            .eq('id', customerId);
    }

    const cylindersByType = {};
    for (const item of items) {
        const serial = item.serial_number;
        if (!serial) continue;
        const cylInfo = cylindersData?.find((c) => c.serial_number === serial);
        let itemName = 'Bình 4L';
        if (cylInfo?.volume) {
            const vol = String(cylInfo.volume).toLowerCase();
            if (vol.includes('8l') || vol.includes('8 l')) itemName = 'Bình 8L';
            else if (vol.includes('4l') || vol.includes('4 l')) itemName = 'Bình 4L';
        }
        cylindersByType[itemName] = (cylindersByType[itemName] || 0) + 1;
    }

    const custLabel = customerName || 'Khách hàng';
    for (const [itemName, qty] of Object.entries(cylindersByType)) {
        const { data: invRecord } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('warehouse_id', warehouseId)
            .eq('item_type', 'BINH')
            .eq('item_name', itemName)
            .maybeSingle();

        let inventoryId = invRecord?.id;
        if (!inventoryId) {
            const { data: newInv } = await supabase
                .from('inventory')
                .insert([{ warehouse_id: warehouseId, item_type: 'BINH', item_name: itemName, quantity: 0 }])
                .select()
                .single();
            inventoryId = newInv?.id;
        }

        if (inventoryId) {
            const serialPart = serialNumbers.length
                ? ` | Serial: ${serialNumbers.join(', ')}`
                : '';
            await supabase.from('inventory_transactions').insert([
                {
                    inventory_id: inventoryId,
                    transaction_type: 'IN',
                    reference_id: recoveryId,
                    reference_code: recoveryCode,
                    quantity_changed: qty,
                    note: `Thu hồi vỏ thành công | ${itemName} x${qty}${serialPart} | Từ: ${custLabel} (${customerId || '—'}) | Về kho: ${warehouseId || '—'} | Trạng thái: đã về kho | Thời gian: ${new Date().toLocaleString('vi-VN')}`,
                },
            ]);
            await supabase
                .from('inventory')
                .update({ quantity: (invRecord?.quantity || 0) + qty })
                .eq('id', inventoryId);
        }
    }
}

/**
 * Hoàn thành nhanh: đã có dòng vỏ trên phiếu → đổi trạng thái + đồng bộ kho.
 * Chưa có vỏ → gọi onNeedOpenForm (mở form nhập vỏ).
 */
export async function tryQuickCompleteRecovery(supabase, recoveryId, { onNeedOpenForm } = {}) {
    const { data: recovery, error: rErr } = await supabase
        .from('cylinder_recoveries')
        .select('*')
        .eq('id', recoveryId)
        .maybeSingle();

    if (rErr || !recovery) {
        toast.error('Không tìm thấy phiếu thu hồi.');
        return { error: true };
    }

    if (recovery.status === 'HOAN_THANH') {
        toast.info('Phiếu đã ở trạng thái Hoàn thành.');
        return { alreadyDone: true };
    }

    const { data: itemRows } = await supabase
        .from('cylinder_recovery_items')
        .select('*')
        .eq('recovery_id', recoveryId);

    const items = itemRows || [];
    if (items.length === 0) {
        toast.info('Vui lòng nhập danh sách vỏ trên phiếu, sau đó nhấn Hoàn thành lại.');
        onNeedOpenForm?.();
        return { needForm: true };
    }

    if (!recovery.customer_id || !recovery.warehouse_id) {
        toast.error('Phiếu thiếu khách hàng hoặc kho nhận. Mở phiếu để bổ sung.');
        onNeedOpenForm?.();
        return { needForm: true };
    }

    const serials = items.map((i) => String(i.serial_number || '').trim()).filter(Boolean);
    if (serials.length !== items.length) {
        toast.error('Có dòng chưa có mã serial. Mở phiếu để kiểm tra.');
        onNeedOpenForm?.();
        return { needForm: true };
    }

    const { data: cust } = await supabase
        .from('customers')
        .select('id, name')
        .eq('id', recovery.customer_id)
        .maybeSingle();

    const custName = String(cust?.name || '').trim();
    const { data: cyls } = await supabase
        .from('cylinders')
        .select('serial_number, customer_name')
        .in('serial_number', serials);

    for (const s of serials) {
        const c = cyls?.find((x) => x.serial_number === s);
        if (!c) {
            toast.error(`Vỏ ${s} không tồn tại trong hệ thống.`);
            return { error: true };
        }
        const cn = String(c.customer_name || '').trim();
        if (custName && cn && cn !== custName) {
            toast.error(`Vỏ ${s} không thuộc khách hàng của phiếu.`);
            return { error: true };
        }
    }

    const { error: uErr } = await supabase
        .from('cylinder_recoveries')
        .update({
            status: 'HOAN_THANH',
            total_items: items.length,
            updated_at: new Date().toISOString(),
        })
        .eq('id', recoveryId);

    if (uErr) {
        toast.error('Không thể cập nhật phiếu: ' + uErr.message);
        return { error: true };
    }

    try {
        await applyRecoveryCompletionInventory(supabase, {
            recoveryId,
            recoveryCode: recovery.recovery_code,
            customerId: recovery.customer_id,
            customerName: cust?.name || 'Khách hàng',
            warehouseId: recovery.warehouse_id,
            items: items.map((i) => ({ serial_number: i.serial_number })),
        });
    } catch (e) {
        console.error(e);
        toast.error('Đã lưu Hoàn thành nhưng lỗi đồng bộ kho: ' + (e.message || e));
        return { error: true };
    }

    notificationService.add({
        title: `✅ Đã thu hồi xong: #${recovery.recovery_code}`,
        description: `${cust?.name || 'Khách hàng'} - Đã thu ${items.length} vỏ về kho.`,
        type: 'success',
        link: '/thu-hoi-vo',
    });

    toast.success('Đã hoàn thành thu hồi.');
    return { ok: true };
}
