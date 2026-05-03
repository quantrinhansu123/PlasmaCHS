import {
    Activity,
    ActivitySquare,
    Building2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Inbox,
    LogIn,
    LogOut,
    MapPin,
    Package,
    RotateCcw,
    Truck,
    Users,
    Warehouse,
    X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ORDER_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';

/** Loại đơn xuất / giao khách (theo mã orderConstants + legacy THUONG + tên có dấu). Không gồm DNXM. */
const MACHINE_ONLY_ORDER_TYPES = new Set(['DNXM']);
const OUTGOING_DELIVERY_ORDER_TYPES = new Set([
    'THUONG',
    ...ORDER_TYPES.filter((ot) => !MACHINE_ONLY_ORDER_TYPES.has(ot.id)).map((ot) => ot.id),
]);

function orderTypeIsOutgoingDelivery(orderType) {
    const raw = String(orderType || '').trim();
    const u = raw.toUpperCase();
    if (MACHINE_ONLY_ORDER_TYPES.has(u)) return false;
    if (OUTGOING_DELIVERY_ORDER_TYPES.has(u)) return true;
    const t = raw.toLowerCase();
    if (t.includes('thuê') || t.includes('bán') || t.includes('giao') || t.includes('xuất')) return true;
    if (t.includes('thuong')) return true;
    if (t === 'ban' || t === 'thue') return true;
    if (t.includes('demo')) return true;
    return false;
}

export default function CylinderDetailsModal({ cylinder, onClose }) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [storageHistory, setStorageHistory] = useState([]);
    const [showFullTimeline, setShowFullTimeline] = useState(false);
    const [qcData, setQcData] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [warehouseName, setWarehouseName] = useState(cylinder?.warehouses?.name || null);
    /** Phiếu nhập NCC (goods_receipts) liên quan serial */
    const [receiptImports, setReceiptImports] = useState([]);
    /** Phiếu thu hồi vỏ (cylinder_recoveries) — đã gộp theo phiếu */
    const [recoveryList, setRecoveryList] = useState([]);
    /** Giao dịch tồn kho (note có chứa serial) */
    const [inventoryTxRows, setInventoryTxRows] = useState([]);
    /** Map id/mã kho → tên (dùng hiển thị cột Nhập) */
    const [warehouseIdToName, setWarehouseIdToName] = useState({});
    /** Dòng đang mở chi tiết trong cột Nhập & điều chuyển */
    const [expandedImportKey, setExpandedImportKey] = useState(null);
    /** Tên NCC khi bình đã trả NCC (resolve từ join hoặc suppliers theo supplier_id) */
    const [returnedNccName, setReturnedNccName] = useState(() => cylinder?.suppliers?.name || null);

    const resolveWarehouseName = useCallback((warehouseValue, warehouseMap = {}) => {
        if (!warehouseValue) return '—';
        return warehouseMap[warehouseValue] || warehouseValue;
    }, []);

    useEffect(() => {
        setExpandedImportKey(null);
    }, [cylinder?.id]);

    useEffect(() => {
        const fromJoin = cylinder?.suppliers?.name;
        if (fromJoin) {
            setReturnedNccName(fromJoin);
            return;
        }
        const sid = cylinder?.supplier_id;
        if (!sid) {
            setReturnedNccName(null);
            return;
        }
        let cancelled = false;
        supabase
            .from('suppliers')
            .select('name')
            .eq('id', sid)
            .maybeSingle()
            .then(({ data }) => {
                if (cancelled) return;
                setReturnedNccName(data?.name || null);
            });
        return () => {
            cancelled = true;
        };
    }, [cylinder?.id, cylinder?.supplier_id, cylinder?.suppliers?.name]);

    useEffect(() => {
        if (!cylinder) return;
        setWarehouseName(cylinder.warehouses?.name || null);
        fetchAllHistory();
        // Resolve warehouse name if not available from join
        if (!cylinder.warehouses?.name && cylinder.warehouse_id) {
            supabase.from('warehouses').select('name').eq('id', cylinder.warehouse_id).maybeSingle()
                .then(({ data }) => { if (data) setWarehouseName(data.name); });
        }
    }, [cylinder]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    }, [onClose]);

    const fetchAllHistory = async () => {
        setLoading(true);
        setReceiptImports([]);
        setRecoveryList([]);
        setInventoryTxRows([]);
        setWarehouseIdToName({});
        try {
            // 0. Fetch warehouse lookup for resolving UUIDs to names
            const { data: warehouseList } = await supabase.from('warehouses').select('id, name');
            const warehouseMap = {};
            (warehouseList || []).forEach(w => { warehouseMap[w.id] = w.name; });
            setWarehouseIdToName(warehouseMap);

            const serialRaw = String(cylinder.serial_number || '').trim();
            const serialVariants = [...new Set([
                serialRaw,
                serialRaw.toUpperCase(),
                serialRaw.toLowerCase(),
            ])].filter(Boolean);

            const arrayContainsOrClause = (column, variants) =>
                variants.map((v) => `${column}.cs.{${v}}`).join(',');

            // 1 — Lịch sử liên quan đơn hàng: chỉ từ bảng `orders` + `order_items` (khớp serial → load full đơn theo id)
            // 1a. orders.assigned_cylinders (TEXT[] — cs)
            let orderData = [];
            if (serialVariants.length > 0) {
                const { data: ordersByHeader } = await supabase
                    .from('orders')
                    .select('*')
                    .or(arrayContainsOrClause('assigned_cylinders', serialVariants))
                    .order('created_at', { ascending: false });
                orderData = ordersByHeader || [];
            }

            const orderById = new Map((orderData || []).map((o) => [o.id, o]));
            const lineSerialKeys = [...new Set(
                serialVariants.flatMap((v) => {
                    const t = String(v).trim();
                    if (!t) return [];
                    return [t, t.toUpperCase(), t.toLowerCase()];
                })
            )].filter(Boolean);

            // 1b. order_items: assigned_cylinders[] hoặc cột serial_number (một số dòng ghi mã vỏ tại đây)
            if (lineSerialKeys.length > 0) {
                const { data: itemHits } = await supabase
                    .from('order_items')
                    .select('order_id')
                    .or(arrayContainsOrClause('assigned_cylinders', serialVariants));
                const { data: itemSerialHits } = await supabase
                    .from('order_items')
                    .select('order_id')
                    .in('serial_number', lineSerialKeys);
                const mergedHits = [...(itemHits || []), ...(itemSerialHits || [])];
                const extraIds = [...new Set(mergedHits.map((r) => r.order_id).filter(Boolean))].filter(
                    (id) => !orderById.has(id)
                );
                if (extraIds.length > 0) {
                    const { data: extraOrders } = await supabase
                        .from('orders')
                        .select('*')
                        .in('id', extraIds);
                    (extraOrders || []).forEach((o) => orderById.set(o.id, o));
                }
            }

            // 1c. Serial trong orders: ghi chú, khoa/mã máy, người nhận, địa chỉ, delivery_checklist (JSONB)
            if (serialRaw) {
                const esc = serialRaw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
                const p = `%${esc}%`;
                const { data: looseOrders } = await supabase
                    .from('orders')
                    .select('*')
                    .or(`note.ilike.${p},department.ilike.${p},recipient_name.ilike.${p},recipient_address.ilike.${p}`)
                    .order('updated_at', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(50);
                (looseOrders || []).forEach((o) => orderById.set(o.id, o));

                const checklistKeys = new Set();
                for (const v of serialVariants) {
                    [`BINH:${v}`, `BINH ${v}`, v].forEach((k) => checklistKeys.add(k));
                }
                for (const key of checklistKeys) {
                    const { data: chkOrders } = await supabase
                        .from('orders')
                        .select('*')
                        .contains('delivery_checklist', { [key]: true })
                        .limit(25);
                    (chkOrders || []).forEach((o) => orderById.set(o.id, o));
                }
            }

            orderData = Array.from(orderById.values()).sort(
                (a, b) =>
                    new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
            );

            setOrders(orderData || []);

            // 2. Goods Receipts (nhập từ NCC về kho) — chuẩn hóa serial (trim + hoa/thường) để khớp phiếu thu hồi / NCC
            const receiptSerials = [...new Set(
                (serialVariants.length > 0 ? serialVariants : (serialRaw ? [serialRaw] : []))
                    .flatMap((v) => {
                        const t = String(v).trim();
                        if (!t) return [];
                        return [t, t.toUpperCase(), t.toLowerCase()];
                    })
            )].filter(Boolean);
            const { data: receiptItems } = receiptSerials.length === 0
                ? { data: [] }
                : await supabase
                    .from('goods_receipt_items')
                    .select('*, goods_receipts!inner(receipt_code, supplier_name, warehouse_id, receipt_date, status)')
                    .in('serial_number', receiptSerials);

            // 3. Goods Issues (xuất trả về NCC)
            const { data: issueItems } = receiptSerials.length === 0
                ? { data: [] }
                : await supabase
                    .from('goods_issue_items')
                    .select(
                        '*, goods_issues!inner(issue_code, supplier_id, warehouse_id, issue_date, status, suppliers(name))'
                    )
                    .in('item_code', receiptSerials);

            // 3b. Nhật ký hệ thống (trigger / xuất nhập / máy giao…)
            let logRows = [];
            if (receiptSerials.length > 0) {
                const { data: logs } = await supabase
                    .from('cylinder_logs')
                    .select('*')
                    .in('serial_number', receiptSerials)
                    .order('created_at', { ascending: false });
                logRows = logs || [];
            }

            // 3c. Phiếu thu hồi vỏ — không dùng embed (FK đôi khi trả null → mất cả dòng); load phiếu riêng theo recovery_id
            let recoveryRows = [];
            if (receiptSerials.length > 0) {
                let recItems = [];
                const { data: byExact } = await supabase
                    .from('cylinder_recovery_items')
                    .select('recovery_id, serial_number, condition, note, created_at')
                    .in('serial_number', receiptSerials);
                recItems = byExact || [];

                if (recItems.length === 0 && serialRaw.length >= 3) {
                    const esc = serialRaw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
                    const { data: byLike } = await supabase
                        .from('cylinder_recovery_items')
                        .select('recovery_id, serial_number, condition, note, created_at')
                        .ilike('serial_number', `%${esc}%`)
                        .limit(40);
                    recItems = byLike || [];
                }

                const recoveryIds = [...new Set(recItems.map((r) => r.recovery_id).filter(Boolean))];
                const recByRecoveryId = new Map();
                if (recoveryIds.length > 0) {
                    const { data: recs } = await supabase
                        .from('cylinder_recoveries')
                        .select('id, recovery_code, recovery_date, status, notes')
                        .in('id', recoveryIds);
                    (recs || []).forEach((r) => recByRecoveryId.set(r.id, r));
                }
                recoveryRows = recItems.map((row) => ({
                    ...row,
                    cylinder_recoveries: recByRecoveryId.get(row.recovery_id) || null,
                }));
            }

            const seenReceipt = new Set();
            const receiptSummaries = [];
            (receiptItems || []).forEach((ri) => {
                const r = ri.goods_receipts;
                if (!r) return;
                const key = r.receipt_code || ri.id;
                if (seenReceipt.has(key)) return;
                seenReceipt.add(key);
                receiptSummaries.push({ ...r, _lineDate: ri.created_at });
            });
            receiptSummaries.sort((a, b) => new Date(b.receipt_date || b._lineDate) - new Date(a.receipt_date || a._lineDate));
            setReceiptImports(receiptSummaries);

            const recById = new Map();
            recoveryRows.forEach((row) => {
                const rec = row.cylinder_recoveries;
                if (!rec?.id) return;
                if (!recById.has(rec.id)) {
                    recById.set(rec.id, {
                        ...rec,
                        _itemCondition: row.condition,
                        _itemNote: row.note || '',
                    });
                }
            });
            setRecoveryList(
                Array.from(recById.values()).sort(
                    (a, b) => new Date(b.recovery_date || 0) - new Date(a.recovery_date || 0)
                )
            );

            // 3d. Giao dịch tồn kho (ghi chú có serial — ví dụ chốt thu hồi / điều chỉnh)
            let invTxData = [];
            if (serialRaw) {
                const esc = serialRaw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
                const p = `%${esc}%`;
                const { data: invTx } = await supabase
                    .from('inventory_transactions')
                    .select('id, transaction_type, reference_code, quantity_changed, note, created_at')
                    .ilike('note', p)
                    .order('created_at', { ascending: false })
                    .limit(40);
                invTxData = invTx || [];
            }
            setInventoryTxRows(invTxData);

            // 4. QC Data
            const { data: qcDataRes } = await supabase
                .from('cylinder_qc_records')
                .select('*')
                .eq('serial_number', cylinder.serial_number)
                .maybeSingle();

            if (qcDataRes) {
                setQcData(qcDataRes);
            } else {
                setQcData(null);
            }

            // Build unified timeline
            const events = [];

            // From orders
            (orderData || []).forEach(o => {
                const type = o.order_type?.toLowerCase() || '';
                const isOutgoing = orderTypeIsOutgoingDelivery(o.order_type);
                const isInternal = o.customer_name === 'Vỏ bình' || type.includes('điều chuyển') || type.includes('thay đổi kho') || type.includes('nội bộ') || type.includes('kho sang kho');
                const isCustomerRecovery =
                    type.includes('thu hồi') ||
                    (type.includes('trả') && !type.includes('ncc') && !type.includes('nhà cung cấp') && !type.includes('nha cung cap'));
                const isWarehouseImport = !isCustomerRecovery && type.includes('nhập');

                // Map raw order_type ID to Friendly Label
                let typeLabel = getOrderTypeLabel(o.order_type);

                let eventLabel = typeLabel || 'Đơn hàng';
                let eventIcon = 'warehouse';
                let eventColor = 'blue';
                let eventType = 'DON_KHAC';
                const orderWarehouseName = resolveWarehouseName(o.warehouse, warehouseMap);
                let location = o.customer_name || orderWarehouseName || '—';
                let rawLocation = orderWarehouseName || o.customer_name || 'Không xác định';

                if (isOutgoing) {
                    eventLabel = typeLabel || 'Giao cho khách';
                    eventIcon = 'outgoing';
                    eventColor = 'rose';
                    eventType = 'GIAO_KHACH';
                    location = `${orderWarehouseName} → ${o.customer_name || 'Khách hàng'}`;
                    rawLocation = orderWarehouseName;
                } else if (isInternal) {
                    eventLabel = 'Điều chuyển nội bộ';
                    eventIcon = 'warehouse';
                    eventColor = 'blue';
                    eventType = 'DIEU_CHUYEN';
                    location = `${orderWarehouseName} → Kho nhận`;
                    rawLocation = orderWarehouseName;
                } else if (isCustomerRecovery) {
                    eventLabel = typeLabel || 'Thu hồi về kho';
                    eventIcon = 'incoming';
                    eventColor = 'teal';
                    eventType = 'THU_HOI';
                    location = `${o.customer_name || 'Khách'} → ${orderWarehouseName}`;
                    rawLocation = o.customer_name || orderWarehouseName;
                } else if (isWarehouseImport) {
                    eventLabel = typeLabel || 'Nhập kho (đơn hàng)';
                    eventIcon = 'incoming';
                    eventColor = 'emerald';
                    eventType = 'NHAP_DON';
                    location = `${o.customer_name || 'Nguồn'} → ${orderWarehouseName}`;
                    rawLocation = orderWarehouseName;
                }

                events.push({
                    date: o.updated_at || o.created_at,
                    type: eventType,
                    label: eventLabel,
                    location: location,
                    rawLocation,
                    code: o.order_code,
                    status: o.status,
                    icon: eventIcon,
                    color: eventColor,
                    source: 'order'
                });
            });

            // From goods receipts
            (receiptItems || []).forEach(ri => {
                const r = ri.goods_receipts;
                const whName = resolveWarehouseName(r.warehouse_id, warehouseMap);
                events.push({
                    date: r.receipt_date || ri.created_at,
                    type: 'NHAP_KHO',
                    label: 'Nhập kho từ NCC',
                    location: `NCC ${r.supplier_name} → Kho ${whName}`,
                    rawLocation: `Kho ${whName}`,
                    code: r.receipt_code,
                    status: r.status,
                    icon: 'supplier',
                    color: 'emerald',
                    source: 'receipt'
                });
            });

            // From goods issues
            (issueItems || []).forEach(ii => {
                const gi = ii.goods_issues;
                const whName = resolveWarehouseName(gi.warehouse_id, warehouseMap);
                const nccName = gi?.suppliers?.name || null;
                events.push({
                    date: gi.issue_date || ii.created_at,
                    type: 'TRA_NCC',
                    label: nccName ? `Trả về ${nccName}` : 'Trả về NCC',
                    location: nccName ? `Kho ${whName} → ${nccName}` : `Kho ${whName} → (chưa rõ NCC)`,
                    rawLocation: `Kho ${whName}`,
                    supplierName: nccName,
                    code: gi.issue_code,
                    status: gi.status,
                    icon: 'supplier',
                    color: 'amber',
                    source: 'issue'
                });
            });

            // From cylinder_logs (cập nhật trạng thái, giao máy, v.v.)
            (logRows || []).forEach((log) => {
                events.push({
                    date: log.created_at,
                    type: 'LOG',
                    label: log.action || 'Ghi nhận hệ thống',
                    location: log.description || '—',
                    rawLocation: resolveWarehouseName(log.warehouse_id, warehouseMap),
                    code: log.action || 'LOG',
                    status: 'LOG_ENTRY',
                    icon: 'warehouse',
                    color: 'blue',
                    source: 'cylinder_log',
                });
            });

            // From thu hồi vỏ
            (recoveryRows || []).forEach((row) => {
                const rec = row.cylinder_recoveries;
                if (!rec) return;
                const st = rec.status || '';
                const done = st === 'HOAN_THANH';
                events.push({
                    date: rec.recovery_date || row.created_at,
                    type: 'THU_HOI_VO',
                    label: done ? 'Thu hồi vỏ (hoàn thành)' : `Thu hồi vỏ (${st})`,
                    location: rec.notes || `Phiếu ${rec.recovery_code}`,
                    rawLocation: rec.recovery_code,
                    code: rec.recovery_code,
                    status: st || '—',
                    icon: 'incoming',
                    color: done ? 'teal' : 'amber',
                    source: 'recovery',
                });
            });

            // From inventory_transactions
            (invTxData || []).forEach((tx) => {
                const isIn = tx.transaction_type === 'IN';
                events.push({
                    date: tx.created_at,
                    type: isIn ? 'NHAP_KHO' : 'XUAT_TON_KHO',
                    label: isIn ? 'Nhập tồn kho' : 'Xuất tồn kho',
                    location: tx.note || tx.reference_code || '—',
                    rawLocation: tx.reference_code || 'Tồn kho',
                    code: tx.reference_code || tx.id,
                    status: tx.transaction_type || '—',
                    icon: isIn ? 'incoming' : 'outgoing',
                    color: isIn ? 'emerald' : 'rose',
                    source: 'inventory_tx',
                    _invId: tx.id,
                });
            });

            // Sort by date descending (newest first)
            events.sort((a, b) => new Date(b.date) - new Date(a.date));
            setTimeline(events);

            // Calculate Storage History (Top 3 unique locations)
            const distinctLocations = [];
            events.forEach(e => {
                const loc = e.rawLocation;
                if (loc && !distinctLocations.includes(loc) && distinctLocations.length < 3) {
                    distinctLocations.push(loc);
                }
            });
            setStorageHistory(distinctLocations);

        } catch (error) {
            console.error('Error fetching cylinder lifecycle:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const getStatusStyle = (status) => {
        if (['DA_DUYET', 'HOAN_THANH'].includes(status)) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
        if (['HUY_DON', 'DOI_SOAT_THAT_BAI', 'HUY'].includes(status)) return 'bg-rose-50 text-rose-600 border-rose-200';
        if (status === 'LOG_ENTRY') return 'bg-slate-100 text-slate-600 border-slate-200';
        return 'bg-amber-50 text-amber-600 border-amber-200';
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'CHO_DUYET': return 'Chờ duyệt';
            case 'CHO_CTY_DUYET': return 'Chờ Cty duyệt';
            case 'KHO_XU_LY': return 'Kho đang xử lý';
            case 'DA_DUYET': return 'Đã xuất kho';
            case 'CHO_GIAO_HANG': return 'Chờ giao hàng';
            case 'DANG_GIAO_HANG': return 'Đang giao';
            case 'CHO_DOI_SOAT': return 'Chờ đối soát';
            case 'HOAN_THANH': return 'Hoàn thành';
            case 'HUY_DON': return 'Đã hủy';
            case 'DOI_SOAT_THAT_BAI': return 'Lỗi đối soát';
            case 'DIEU_CHINH': return 'Cần điều chỉnh';
            case 'LOG_ENTRY': return 'Nhật ký';
            case 'CHO_PHAN_CONG': return 'Chờ phân công';
            case 'DANG_THU_HOI': return 'Đang thu hồi';
            case 'IN': return 'Nhập tồn';
            case 'OUT': return 'Xuất tồn';
            default: return status || '—';
        }
    };

    const getOrderTypeLabel = (type) => {
        if (!type) return '—';
        const t = type.toUpperCase();
        switch (t) {
            case 'THUONG': return 'Đơn bán / Thuê';
            case 'DEMO': return 'Đơn dùng thử (Demo)';
            case 'NGOAI_GIAO': return 'Đơn ngoại giao';
            case 'NGHIEN_CUU': return 'Đơn nghiên cứu';
            default: return type;
        }
    };

    /** Đơn thu hồi / trả từ khách (không gộp với nhập kho NCC) */
    const orderIsRecoveryFromCustomer = (o) => {
        const t = (o.order_type || '').toLowerCase();
        if (t.includes('thu hồi')) return true;
        if (t.includes('trả') && !t.includes('ncc') && !t.includes('nhà cung cấp') && !t.includes('nha cung cap')) return true;
        return false;
    };

    /** Nhập kho / điều chuyển nội bộ (không bao gồm thu hồi vỏ khách) */
    const orderIsImportOrInternal = (o) => {
        const t = (o.order_type || '').toLowerCase();
        if (orderIsRecoveryFromCustomer(o)) return false;
        if (t.includes('nhập')) return true;
        if (o.customer_name === 'Vỏ bình') return true;
        if (t.includes('điều chuyển') || t.includes('thay đổi kho') || t.includes('nội bộ') || t.includes('kho sang kho')) return true;
        return false;
    };

    const outgoingOrders = useMemo(() => orders.filter((o) => orderTypeIsOutgoingDelivery(o.order_type)), [orders]);

    const importOrders = useMemo(() => orders.filter(orderIsImportOrInternal), [orders]);
    const recoveryOrders = useMemo(() => orders.filter(orderIsRecoveryFromCustomer), [orders]);

    const inventoryInRows = useMemo(
        () => inventoryTxRows.filter((r) => r.transaction_type === 'IN'),
        [inventoryTxRows]
    );

    const timelineCol2Extra = useMemo(() => {
        const orderCodes = new Set(importOrders.map((o) => o.order_code).filter(Boolean));
        const receiptCodes = new Set(receiptImports.map((r) => r.receipt_code).filter(Boolean));
        return timeline.filter((e) => {
            if (e.source === 'inventory_tx') return false;
            if (!['NHAP_KHO', 'NHAP_DON', 'DIEU_CHUYEN', 'TRA_NCC', 'LOG'].includes(e.type)) return false;
            if (e.source === 'order' && e.code && orderCodes.has(e.code)) return false;
            if (e.source === 'receipt' && e.code && receiptCodes.has(e.code)) return false;
            return true;
        });
    }, [timeline, importOrders, receiptImports]);

    const timelineCol3Extra = useMemo(() => {
        const recCodes = new Set(recoveryList.map((r) => r.recovery_code).filter(Boolean));
        const orderCodes = new Set(recoveryOrders.map((o) => o.order_code).filter(Boolean));
        return timeline.filter((e) => {
            if (!['THU_HOI', 'THU_HOI_VO'].includes(e.type)) return false;
            if (e.source === 'recovery' && e.code && recCodes.has(e.code)) return false;
            if (e.source === 'order' && e.code && orderCodes.has(e.code)) return false;
            return true;
        });
    }, [timeline, recoveryList, recoveryOrders]);

    const importTransferRows = useMemo(() => {
        const wm = warehouseIdToName;
        const rows = [];

        receiptImports.forEach((r) => {
            const wh = resolveWarehouseName(r.warehouse_id, wm);
            rows.push({
                key: `rec-${r.receipt_code || r.id}`,
                shortTitle: `Nhập về kho ${wh}`,
                subtitle: `${r.receipt_code || '—'} · ${formatDate(r.receipt_date || r._lineDate)}`,
                sortDate: r.receipt_date || r._lineDate,
                detail: { type: 'receipt', r },
            });
        });

        importOrders.forEach((o) => {
            const t = o.order_type?.toLowerCase() || '';
            const isInternal = o.customer_name === 'Vỏ bình' || t.includes('điều chuyển') || t.includes('kho sang kho') || t.includes('nội bộ');
            const wh = resolveWarehouseName(o.warehouse, wm);
            rows.push({
                key: `ord-${o.id}`,
                shortTitle: isInternal ? `Điều chuyển nội bộ · kho ${wh}` : `Nhập về kho ${wh}`,
                subtitle: `${o.order_code} · ${formatDate(o.created_at)}`,
                sortDate: o.created_at,
                detail: { type: 'order', o, isInternal },
            });
        });

        inventoryInRows.forEach((tx) => {
            const m = tx.note && String(tx.note).match(/Về kho:\s*([^|]+)/);
            const whRaw = m ? m[1].trim() : '—';
            const wh = resolveWarehouseName(whRaw, wm);
            rows.push({
                key: `inv-${tx.id}`,
                shortTitle: `Nhập tồn kho về ${wh}`,
                subtitle: `${tx.reference_code || '—'} · ${formatDate(tx.created_at)}`,
                sortDate: tx.created_at,
                detail: { type: 'inv', tx },
            });
        });

        timelineCol2Extra.forEach((ev, i) => {
            const loc = ev.location || '';
            const parts = loc.split('→');
            let whLabel = resolveWarehouseName(ev.rawLocation, wm);
            if (parts.length >= 2) {
                const right = parts[parts.length - 1].trim();
                whLabel = right.startsWith('Kho ')
                    ? resolveWarehouseName(right.slice(4).trim(), wm)
                    : resolveWarehouseName(right, wm);
            } else if (String(ev.rawLocation || '').startsWith('Kho ')) {
                whLabel = resolveWarehouseName(String(ev.rawLocation).slice(4).trim(), wm);
            }
            let shortTitle = `Nhập về kho ${whLabel}`;
            if (ev.type === 'TRA_NCC') {
                shortTitle = ev.supplierName
                    ? `${ev.supplierName} · từ kho ${whLabel}`
                    : `Chưa rõ NCC · từ kho ${whLabel}`;
            }
            if (ev.type === 'DIEU_CHUYEN') shortTitle = `Điều chuyển · kho ${whLabel}`;
            if (ev.type === 'LOG') shortTitle = ev.label || 'Ghi nhận hệ thống';
            rows.push({
                key: `tl-${ev.type}-${ev.code}-${ev.date}-${i}`,
                shortTitle,
                subtitle: `${ev.code || '—'} · ${formatDate(ev.date)}`,
                sortDate: ev.date,
                detail: { type: 'timeline', ev },
            });
        });

        rows.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
        return rows;
    }, [receiptImports, importOrders, inventoryInRows, timelineCol2Extra, warehouseIdToName, resolveWarehouseName]);

    const renderImportExpandedDetail = (detail) => {
        switch (detail.type) {
            case 'receipt': {
                const r = detail.r;
                return (
                    <div className="space-y-2 text-xs">
                        <p><span className="font-bold text-slate-500">Phiếu:</span> {r.receipt_code}</p>
                        <p><span className="font-bold text-slate-500">NCC:</span> {r.supplier_name || '—'}</p>
                        <p><span className="font-bold text-slate-500">Kho nhận:</span> {resolveWarehouseName(r.warehouse_id, warehouseIdToName)}</p>
                        <p><span className="font-bold text-slate-500">Ngày:</span> {formatDate(r.receipt_date || r._lineDate)}</p>
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getStatusStyle(r.status)}`}>{getStatusLabel(r.status)}</span>
                    </div>
                );
            }
            case 'order': {
                const o = detail.o;
                const isInternal = detail.isInternal;
                return (
                    <div className="space-y-2 text-xs">
                        <p><span className="font-bold text-slate-500">Đơn:</span> {o.order_code}</p>
                        <p><span className="font-bold text-slate-500">Kho:</span> {resolveWarehouseName(o.warehouse, warehouseIdToName)}</p>
                        <p><span className="font-bold text-slate-500">Đối tượng:</span> {isInternal ? 'Điều chuyển / nội bộ' : (o.customer_name || '—')}</p>
                        <p><span className="font-bold text-slate-500">Loại:</span> {getOrderTypeLabel(o.order_type) || 'Đơn nhập'}</p>
                        <p><span className="font-bold text-slate-500">Ngày:</span> {formatDate(o.created_at)}</p>
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getStatusStyle(o.status)}`}>{getStatusLabel(o.status)}</span>
                    </div>
                );
            }
            case 'inv': {
                const tx = detail.tx;
                return (
                    <div className="space-y-2 text-xs">
                        <p><span className="font-bold text-slate-500">Tham chiếu:</span> {tx.reference_code || '—'}</p>
                        <p><span className="font-bold text-slate-500">Loại:</span> {getStatusLabel(tx.transaction_type)}</p>
                        <p><span className="font-bold text-slate-500">Số lượng:</span> {tx.quantity_changed ?? '—'}</p>
                        <p className="text-slate-600 whitespace-pre-wrap break-words"><span className="font-bold text-slate-500">Ghi chú:</span> {tx.note || '—'}</p>
                        <p><span className="font-bold text-slate-500">Thời điểm:</span> {formatDate(tx.created_at)}</p>
                    </div>
                );
            }
            case 'timeline': {
                const ev = detail.ev;
                return (
                    <div className="space-y-2 text-xs">
                        <p><span className="font-bold text-slate-500">Sự kiện:</span> {ev.label}</p>
                        <p className="text-slate-700 whitespace-pre-wrap break-words">{ev.location}</p>
                        <p><span className="font-bold text-slate-500">Mã:</span> {ev.code}</p>
                        <p><span className="font-bold text-slate-500">Ngày:</span> {formatDate(ev.date)}</p>
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getStatusStyle(ev.status)}`}>{getStatusLabel(ev.status)}</span>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    const getEventIcon = (iconType) => {
        switch (iconType) {
            case 'outgoing': return <Users className="w-4 h-4" />;
            case 'incoming': return <LogIn className="w-4 h-4" />;
            case 'warehouse': return <Warehouse className="w-4 h-4" />;
            case 'supplier': return <Building2 className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    const colorMap = {
        rose: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', iconBg: 'bg-rose-100' },
        teal: { dot: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', iconBg: 'bg-teal-100' },
        emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
        amber: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', iconBg: 'bg-amber-100' },
        blue: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', iconBg: 'bg-blue-100' }
    };

    const displayedTimeline = showFullTimeline ? timeline : timeline.slice(0, 3);

    const content = (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header Profile */}
            <div className="bg-white px-4 md:px-8 py-4 md:py-6 border-b border-slate-200 shrink-0 overflow-hidden sticky top-0 z-20">
                <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-start md:items-center gap-3 md:gap-5 min-w-0">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/10 shrink-0">
                            <ActivitySquare className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1 tracking-tight flex items-center gap-2 md:gap-3 truncate">
                                Vỏ bình {cylinder.serial_number}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-slate-500">
                                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-400" /> {cylinder.volume || '—'}</span>
                                {cylinder.category && <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{cylinder.category}</span>}
                                {cylinder.cylinder_code && <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md">Mã khắc: {cylinder.cylinder_code}</span>}
                                <span className="flex items-center gap-1.5 text-primary">
                                    <Activity className="w-4 h-4 text-primary/60" /> 
                                    {cylinder.status ? (cylinder.status.charAt(0).toUpperCase() + cylinder.status.slice(1)) : '—'}
                                </span>
                                <span className="flex items-center gap-1.5 text-indigo-600">
                                    <MapPin className="w-4 h-4 text-indigo-400" />
                                    {(() => {
                                        const status = cylinder.status;
                                        if (['thuộc khách hàng', 'đang sử dụng', 'đã sử dụng'].includes(status)) {
                                            return cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—';
                                        }
                                        if (status === 'đang vận chuyển') return '—';
                                        if (status === 'đã trả ncc') {
                                            return returnedNccName || '—';
                                        }
                                        if (['sẵn sàng', 'bình rỗng', 'chờ nạp', 'hỏng'].includes(status)) {
                                            return warehouseName || cylinder.warehouses?.name || '—';
                                        }
                                        return cylinder.customer_name?.split(' / ')[1] || '—';
                                    })()}
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-500">
                                    <Warehouse className="w-4 h-4 text-slate-400" />
                                    {warehouseName || cylinder.warehouses?.name || '—'}
                                </span>
                                {cylinder.expiry_date && <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 italic">Hạn: {formatDate(cylinder.expiry_date)}</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                {/* Top 3 Storage History */}
                {!loading && storageHistory.length > 0 && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative z-10 shadow-sm">
                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> 3 Nơi lưu trữ mới nhất
                        </p>
                        <div className="flex items-center gap-2 md:gap-4">
                            {storageHistory.map((loc, idx) => (
                                <div key={idx} className="flex items-center gap-2 md:gap-4 flex-1">
                                    <div className="bg-white px-3 md:px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm grow min-w-0 hover:border-primary/30 transition-all">
                                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">Vị trí {idx + 1}</p>
                                        <p className="font-black text-slate-800 text-xs md:text-sm truncate">{loc}</p>
                                    </div>
                                    {idx < storageHistory.length - 1 && (
                                        <span className="text-slate-300 font-black">←</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col flex-1 items-center justify-center h-40 space-y-4 py-16">
                        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest italic">Đang tải lịch sử luân chuyển...</p>
                    </div>
                ) : (
                    <>
                        {/* Timeline Section - Vòng đời bình */}
                        <div className="px-4 md:px-8 pt-6 md:pt-8 pb-4">
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 min-w-0">
                                    <Truck className="w-4 h-4 text-slate-400" />
                                    <span className="truncate">Vòng đời — {timeline.length} sự kiện</span>
                                </h3>
                                {timeline.length > 3 && (
                                    <button
                                        onClick={() => setShowFullTimeline(!showFullTimeline)}
                                        className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary px-2.5 md:px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        {showFullTimeline ? (
                                            <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                                        ) : (
                                            <><ChevronDown className="w-3.5 h-3.5" /> Xem tất cả ({timeline.length})</>
                                        )}
                                    </button>
                                )}
                            </div>

                            {timeline.length === 0 ? (
                                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-sm transition-all hover:border-primary/20">
                                    <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold text-sm">Chưa có lịch sử luân chuyển nào</p>
                                </div>
                            ) : (
                                <div className="space-y-0 relative">
                                    {/* Vertical line */}
                                    <div className="absolute left-[15px] md:left-[19px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

                                    {displayedTimeline.map((event, idx) => {
                                        const c = colorMap[event.color] || colorMap.teal;
                                        return (
                                            <div key={idx} className="flex items-start gap-3 md:gap-4 relative group">
                                                {/* Dot */}
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${c.iconBg} ${c.text} flex items-center justify-center shrink-0 z-10 shadow-sm border ${c.border} transition-all group-hover:scale-110 group-hover:shadow-md`}>
                                                    {getEventIcon(event.icon)}
                                                </div>

                                                {/* Content */}
                                                <div className={`flex-1 pb-6`}>
                                                    <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group-hover:border-primary/20">
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{event.label}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{formatDate(event.date)}</span>
                                                        </div>
                                                        <h4 className="font-black text-slate-800 text-sm md:text-base mb-2 tracking-tight">{event.location}</h4>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{event.code}</span>
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getStatusStyle(event.status)}`}>{getStatusLabel(event.status)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!showFullTimeline && timeline.length > 3 && (
                                        <div className="flex items-center gap-4 pl-8 md:pl-10 pt-1">
                                            <p className="text-xs font-bold text-slate-400 italic">
                                                ...và {timeline.length - 3} sự kiện trước đó
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* QC Metadata Section */}
                        {qcData && (
                            <div className="px-4 md:px-8 py-6 bg-white border-y border-slate-100">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-5">
                                    <ActivitySquare className="w-4 h-4 text-primary" />
                                    Thông số kỹ thuật & Kiểm định
                                </h3>
                                <div className="bg-primary/[0.03] border border-primary/10 rounded-2xl p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trọng lượng (kg)</p>
                                        <p className="font-black text-primary text-lg">{qcData.empty_weight}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dung tích (L)</p>
                                        <p className="font-black text-primary text-lg">{qcData.water_capacity}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Thời điểm Test</p>
                                        <p className="font-black text-slate-700 text-xs md:text-sm">{qcData.hold_time || '—'}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Kết luận</p>
                                        <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[10px] font-black inline-block border border-primary/20 shadow-sm">
                                            {qcData.conclusion || 'ĐẠT (OK)'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary: 3 cột — Giao | Nhập/điều chuyển | Thu hồi vỏ */}
                        <div className="flex flex-col lg:flex-row bg-slate-50/50 border-t border-slate-200">
                            {/* Đơn giao / cho thuê */}
                            <div className="flex-1 min-w-0 p-5 md:p-6 lg:border-r border-slate-200">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-primary flex items-center justify-center shadow-sm shrink-0">
                                        <LogOut className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Đơn giao / cho thuê</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Theo bảng đơn hàng — xuất / bán / thuê</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {outgoingOrders.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-sm">
                                            <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest">Chưa có đơn giao / cho thuê</p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Chỉ hiển thị đơn từ bảng orders (xuất, bán, thuê…)</p>
                                        </div>
                                    ) : (
                                        outgoingOrders.map((o) => (
                                            <div key={o.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden hover:border-primary/20">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-60" />
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase border border-slate-200">{o.order_code}</span>
                                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusStyle(o.status)}`}>{getStatusLabel(o.status)}</span>
                                                </div>
                                                <h4 className="font-black text-slate-800 text-sm mb-1 truncate">{o.customer_name}</h4>
                                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{getOrderTypeLabel(o.order_type) || 'Đơn xuất'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1.5">{formatDate(o.updated_at || o.created_at)}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Nhập kho & điều chuyển (không gồm thu hồi từ khách) */}
                            <div className="flex-1 min-w-0 p-5 md:p-6 lg:border-r border-slate-200 bg-emerald-50/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm shrink-0">
                                        <Inbox className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Nhập & điều chuyển</h3>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Chủ yếu hiển thị kho nhận — bấm dòng để xem chi tiết</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {importTransferRows.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-emerald-200/60 rounded-2xl bg-white shadow-sm">
                                            <Inbox className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
                                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest">Chưa có dữ liệu</p>
                                        </div>
                                    ) : (
                                        importTransferRows.map((row) => (
                                            <div key={row.key} className="rounded-xl overflow-hidden border border-emerald-100/90 bg-white shadow-sm">
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-emerald-50/60 transition-colors"
                                                    onClick={() => setExpandedImportKey((k) => (k === row.key ? null : row.key))}
                                                >
                                                    <Warehouse className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 leading-snug">{row.shortTitle}</p>
                                                        <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">{row.subtitle}</p>
                                                    </div>
                                                    <ChevronRight className={clsx(
                                                        'w-4 h-4 text-slate-400 shrink-0 transition-transform',
                                                        expandedImportKey === row.key && 'rotate-90 text-emerald-600'
                                                    )} />
                                                </button>
                                                {expandedImportKey === row.key && (
                                                    <div className="px-3 pb-3 pt-0 border-t border-slate-100 bg-slate-50/80">
                                                        <div className="pt-3 pl-1">
                                                            {renderImportExpandedDetail(row.detail)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Thu hồi vỏ từ khách */}
                            <div className="flex-1 min-w-0 p-5 md:p-6 bg-teal-50/25">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-sm shrink-0">
                                        <RotateCcw className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Thu hồi vỏ</h3>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Phiếu thu hồi, đơn trả / thu hồi từ khách</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {recoveryList.length === 0 && recoveryOrders.length === 0 && timelineCol3Extra.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-teal-200/60 rounded-2xl bg-white shadow-sm">
                                            <RotateCcw className="w-8 h-8 text-teal-200 mx-auto mb-2" />
                                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest">Chưa có dữ liệu</p>
                                        </div>
                                    ) : (
                                        <>
                                            {recoveryList.map((rec) => (
                                                <div key={rec.id} className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500 opacity-70" />
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[9px] font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md uppercase border border-teal-100">{rec.recovery_code}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusStyle(rec.status)}`}>{getStatusLabel(rec.status)}</span>
                                                    </div>
                                                    <h4 className="font-black text-slate-800 text-sm mb-1 line-clamp-2">{rec.notes || 'Phiếu thu hồi vỏ'}</h4>
                                                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Thu hồi từ khách hàng</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5">{formatDate(rec.recovery_date)}</p>
                                                </div>
                                            ))}
                                            {recoveryOrders.map((o) => (
                                                <div key={`rec-ord-${o.id}`} className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-400 opacity-60" />
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase border border-slate-200">{o.order_code}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusStyle(o.status)}`}>{getStatusLabel(o.status)}</span>
                                                    </div>
                                                    <h4 className="font-black text-slate-800 text-sm mb-1 truncate">{o.customer_name}</h4>
                                                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{getOrderTypeLabel(o.order_type) || 'Thu hồi / trả'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5">{formatDate(o.created_at)}</p>
                                                </div>
                                            ))}
                                            {timelineCol3Extra.map((ev, i) => (
                                                <div key={`tl-th-${ev.code}-${ev.date}-${i}`} className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500 opacity-35" />
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[9px] font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md uppercase border border-teal-100">Từ lịch sử</span>
                                                        <span className="text-[10px] font-bold text-slate-400">{formatDate(ev.date)}</span>
                                                    </div>
                                                    <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-1">{ev.label}</p>
                                                    <h4 className="font-black text-slate-800 text-sm mb-1 line-clamp-3">{ev.location}</h4>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{ev.code}</span>
                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${getStatusStyle(ev.status)}`}>{getStatusLabel(ev.status)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Panel */}
            <div 
                className={clsx(
                    "relative bg-white shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </div>
        </div>,
        document.body
    );
}
