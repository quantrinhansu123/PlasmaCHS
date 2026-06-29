import { PRODUCT_TYPES } from '../constants/orderConstants';
import { collectMachineSerialsForOrder, normalizeMachineTypeKey } from './orderMachineSerials';
import {
    getOrderWarehouseLabel,
    resolveWarehouseStorageName,
} from './orderWarehouseScope';
import { resolveInventoryLineForOrder } from './inventoryMatch';
import { resolveWarehouseRow } from './transferWarehouseMatch';
import { notificationService } from './notificationService';

export const WAREHOUSE_RETURN_MARKER = '[PNHAP_LAI_KHO]:';

export function hasWarehouseReturnForOrder(order) {
    return String(order?.note || '').includes(WAREHOUSE_RETURN_MARKER);
}

function parseDeliveryChecklist(raw) {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function normalizeSerial(value) {
    return String(value || '').trim().toUpperCase();
}

function resolveMachineTypeFromRow(row) {
    const raw = String(row?.machine_type || 'TM').trim().toUpperCase();
    if (!raw) return 'TM';
    if (raw === 'KHÁC' || raw === 'KHAC') return 'KHAC';
    return raw;
}

function machineTypeToItemName(machineType) {
    const key = normalizeMachineTypeKey(machineType);
    const direct = PRODUCT_TYPES.find((p) => p.id === key);
    if (direct?.label) return direct.label;
    const may = PRODUCT_TYPES.find((p) => p.id === `MAY_${key}`);
    if (may?.label) return may.label;
    return key === 'KHAC' ? 'Máy khác' : `Máy ${key}`;
}

async function generateNextReceiptCode(client) {
    const { data } = await client
        .from('goods_receipts')
        .select('receipt_code')
        .order('receipt_code', { ascending: false })
        .limit(1);

    if (data?.length > 0 && String(data[0].receipt_code || '').startsWith('PN')) {
        const numStr = String(data[0].receipt_code).match(/\d+/)?.[0] || '0';
        const nextNum = parseInt(numStr, 10) + 1;
        return `PN${nextNum.toString().padStart(5, '0')}`;
    }
    return 'PN00001';
}

async function refundOrderInventory(client, order, orderItems, warehouses, actorName) {
    const actionTime = new Date().toLocaleString('vi-VN');
    for (const item of orderItems || []) {
        const qty = parseInt(item?.quantity, 10);
        if (!qty || qty <= 0) continue;

        const productLabel = PRODUCT_TYPES.find((p) => p.id === item.product_type)?.label || item.product_type;
        const invData = await resolveInventoryLineForOrder(client, {
            warehouseRef: order.warehouse || getOrderWarehouseLabel(order),
            warehouseList: warehouses,
            productType: item.product_type,
            allowCylinderSync: false,
        });

        if (!invData) continue;

        const { error: updateErr } = await client
            .from('inventory')
            .update({ quantity: (invData.quantity || 0) + qty })
            .eq('id', invData.id);
        if (updateErr) throw updateErr;

        await client.from('inventory_transactions').insert([{
            inventory_id: invData.id,
            transaction_type: 'IN',
            reference_id: order.id,
            reference_code: order.order_code,
            quantity_changed: qty,
            note: `Nhập lại kho từ đối soát thất bại | Đơn ${order.order_code} | ${productLabel} x${qty} | Người thực hiện: ${actorName} | ${actionTime}`,
        }]);
    }
}

/**
 * Tạo phiếu nhập kho (CHO_DUYET) và đưa máy trên đơn về kho khi đối soát thất bại.
 */
export async function createWarehouseReturnFromOrder(client, order, {
    warehouses = [],
    actorName = '',
} = {}) {
    if (!order?.id) throw new Error('Thiếu thông tin đơn hàng');

    const statusKey = String(order.status || '').trim().toUpperCase();
    if (statusKey !== 'DOI_SOAT_THAT_BAI') {
        throw new Error('Chỉ áp dụng khi đơn ở trạng thái Đối soát thất bại');
    }
    if (hasWarehouseReturnForOrder(order)) {
        throw new Error('Đơn này đã được nhập lại kho trước đó');
    }

    const { data: orderItems, error: itemsErr } = await client
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
    if (itemsErr) throw itemsErr;

    const deliveryChecklist = parseDeliveryChecklist(order.delivery_checklist);
    const machineSerials = collectMachineSerialsForOrder(order, orderItems || [], deliveryChecklist);
    if (!machineSerials.length) {
        throw new Error('Không tìm thấy mã máy trên đơn để nhập lại kho');
    }

    const warehouseRef = String(order.warehouse || '').trim() || getOrderWarehouseLabel(order);
    const warehouseRow = resolveWarehouseRow(warehouseRef, warehouses);
    if (!warehouseRow?.id) {
        throw new Error(`Không xác định được kho nhận từ đơn (${warehouseRef || 'trống'})`);
    }

    const receiptCode = await generateNextReceiptCode(client);
    const warehouseStorage = resolveWarehouseStorageName(warehouseRow);
    const customerName = String(order.customer_name || order.recipient_name || 'Khách trả máy').trim();

    const { data: machinesData, error: machinesErr } = await client
        .from('machines')
        .select('serial_number, machine_type')
        .in('serial_number', machineSerials);
    if (machinesErr) throw machinesErr;

    const machineBySerial = new Map(
        (machinesData || []).map((m) => [normalizeSerial(m.serial_number), m]),
    );

    const receiptNote = [
        `Nhập lại kho từ đối soát thất bại — Đơn ${order.order_code || order.id}`,
        `${WAREHOUSE_RETURN_MARKER}${order.id}`,
    ].join('\n');

    const { data: newReceipt, error: receiptErr } = await client
        .from('goods_receipts')
        .insert([{
            receipt_code: receiptCode,
            supplier_name: customerName,
            warehouse_id: warehouseRow.id,
            receipt_date: new Date().toISOString().split('T')[0],
            status: 'CHO_DUYET',
            note: receiptNote,
            received_by: actorName || '',
            deliverer_name: customerName,
            deliverer_address: String(order.recipient_address || order.address || '').trim(),
            total_items: machineSerials.length,
            total_amount: 0,
        }])
        .select()
        .single();
    if (receiptErr) throw receiptErr;

    const itemsPayload = machineSerials.map((sn) => {
        const normalized = normalizeSerial(sn);
        const mach = machineBySerial.get(normalized);
        const machineType = resolveMachineTypeFromRow(mach);
        return {
            receipt_id: newReceipt.id,
            item_type: 'MAY',
            item_name: machineTypeToItemName(machineType),
            serial_number: normalized,
            item_status: 'sẵn sàng',
            quantity: 1,
            unit: 'cái',
            unit_price: 0,
            total_price: 0,
            note: `[MACHINE_TYPE:${machineType}]`,
        };
    });

    const { error: itemsInsertErr } = await client.from('goods_receipt_items').insert(itemsPayload);
    if (itemsInsertErr) throw itemsInsertErr;

    for (const sn of machineSerials) {
        const normalized = normalizeSerial(sn);
        const { data: existing, error: fetchErr } = await client
            .from('machines')
            .select('id')
            .ilike('serial_number', normalized)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing?.id) continue;

        const { error: upErr } = await client
            .from('machines')
            .update({
                status: 'sẵn sàng',
                warehouse: warehouseStorage,
                customer_name: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        if (upErr) {
            throw new Error(`Không thể cập nhật máy ${normalized}: ${upErr.message}`);
        }
    }

    await refundOrderInventory(client, order, orderItems, warehouses, actorName);

    const orderNoteAppend = `\n\n[Nhập lại kho ${new Date().toLocaleString('vi-VN')}]: Phiếu ${receiptCode}${actorName ? ` — ${actorName}` : ''}`;
    const { error: orderErr } = await client
        .from('orders')
        .update({
            status: 'TRA_HANG',
            note: `${String(order.note || '').trim()}${orderNoteAppend}`,
            updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    if (orderErr) throw orderErr;

    await notificationService.add({
        title: `📥 Nhập lại kho: #${receiptCode}`,
        description: `Đơn ${order.order_code || '—'} — ${machineSerials.length} máy`,
        type: 'success',
        link: '/nhap-hang',
    });

    return {
        receiptId: newReceipt.id,
        receiptCode,
        receipt: newReceipt,
        items: itemsPayload,
        machineCount: machineSerials.length,
    };
}

/** Tìm phiếu nhập kho đã tạo từ thao tác nhập lại kho của đơn. */
export async function fetchWarehouseReturnReceiptForOrder(client, order) {
    if (!order?.id) return null;
    const marker = `${WAREHOUSE_RETURN_MARKER}${order.id}`;
    const { data, error } = await client
        .from('goods_receipts')
        .select('*')
        .ilike('note', `%${marker}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}
