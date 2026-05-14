export function normalizeTransferActionRecord(row, warehouseNameById = {}) {
    const items = Array.isArray(row?.items_json) ? row.items_json : [];
    const fromWarehouseName =
        warehouseNameById[String(row?.from_warehouse_id)] || row?.from_warehouse_id || '—';
    const toWarehouseName =
        warehouseNameById[String(row?.to_warehouse_id)] || row?.to_warehouse_id || '—';

    return {
        id: row.id,
        transferCode: row.transfer_code,
        status: row.status || 'CHO_DUYET',
        createdAt: row.created_at,
        fromWarehouses: [fromWarehouseName],
        toWarehouses: [toWarehouseName],
        totalQuantity:
            row.total_quantity ||
            items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        items: items.map((item) => ({
            itemName: item.item_name || '—',
            itemType: item.item_type || 'KHAC',
            quantity: Number(item.quantity) || 0,
            codes: (item.specific_codes || []).map((entry) => entry?.code).filter(Boolean),
        })),
    };
}
