import {
    Activity,
    FileText,
    History,
    MapPin,
    MonitorIcon,
    Package,
    User,
    X,
    ChevronRight,
    Calendar,
    ArrowRightLeft,
    Box
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';
import MachineIssueRequestForm from './MachineIssueRequestForm';
import OrderFormModal from '../Orders/OrderFormModal';
import {
    normalizeMachineSerialKey,
    fetchOrderItemsForMachineSerialVariants,
    isOrderDeliveredCompleted,
    resolveOrderCustomerDisplay,
} from '../../utils/machineCustomerFromOrders';

function escapeIlikePattern(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/,/g, '');
}

/** Đơn phiếu Đề nghị xuất máy — mở form DNXM thay vì OrderFormModal. */
function isDnxmOrderRecord(order) {
    if (!order) return false;
    if (order.order_type === 'DNXM') return true;
    return /^DNXM/i.test(String(order.order_code || '').trim());
}

function isMachineProductLine(productType) {
    if (!productType) return false;
    const n = String(productType).trim();
    const u = n.toUpperCase();
    if (u.startsWith('MAY') || n.startsWith('MÁY')) return true;
    return ['TM', 'SD', 'FM', 'Khac', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED', 'MAY_MED_NEW'].includes(n);
}

export default function MachineDetailsModal({ machine, onClose }) {
    const [loading, setLoading] = useState(true);
    const [usingCustomerLabel, setUsingCustomerLabel] = useState(() => String(machine?.customer_name || '').trim() || '—');
    /** Đơn hoàn thành dùng để suy ra khách — hiện mã đơn cho rõ có biên bản. */
    const [usingCustomerOrderCode, setUsingCustomerOrderCode] = useState('');
    const [orders, setOrders] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [isClosing, setIsClosing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    /** Mở phiếu đề nghị xuất máy lồng (tránh navigate / modal đơn tách). */
    const [dnxmPreviewOrderId, setDnxmPreviewOrderId] = useState(null);

    useEffect(() => {
        if (!machine) return;
        setUsingCustomerLabel(String(machine.customer_name || '').trim() || '—');
        setUsingCustomerOrderCode('');
        setSelectedOrder(null);
        setDnxmPreviewOrderId(null);
        fetchMachineHistory();
    }, [machine]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const fetchMachineHistory = async () => {
        setLoading(true);
        try {
            const serial = (machine.serial_number || '').trim();
            const p = `%${escapeIlikePattern(serial)}%`;

            const orderIdSet = new Set();

            if (serial) {
                const [{ data: itemRows, error: itemErr }, { data: deptRows, error: deptErr }, { data: dnxmRows, error: dnxmErr }] =
                    await Promise.all([
                        supabase.from('order_items').select('order_id').ilike('serial_number', p),
                        supabase.from('orders').select('id').ilike('department', p),
                        supabase
                            .from('orders')
                            .select('id')
                            .eq('order_type', 'DNXM')
                            .or(`department.ilike.${p},note.ilike.${p}`),
                    ]);

                if (itemErr) throw itemErr;
                if (deptErr) throw deptErr;
                if (dnxmErr) throw dnxmErr;

                (itemRows || []).forEach((r) => r.order_id && orderIdSet.add(r.order_id));
                (deptRows || []).forEach((r) => r.id && orderIdSet.add(r.id));
                (dnxmRows || []).forEach((r) => r.id && orderIdSet.add(r.id));
            }

            const orderIds = [...orderIdSet];
            const [ordersRes, transferRes] = await Promise.all([
                orderIds.length === 0
                    ? Promise.resolve({ data: [], error: null })
                    : supabase
                          .from('orders')
                          .select('*')
                          .in('id', orderIds)
                          .order('created_at', { ascending: false }),
                supabase
                    .from('inventory_transactions')
                    .select('*')
                    .eq('transaction_type', 'OUT')
                    .like('reference_code', 'TRF%')
                    .ilike('note', `%${escapeIlikePattern(serial)}%`)
                    .order('created_at', { ascending: false }),
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (transferRes.error) throw transferRes.error;

            const ordersData = ordersRes.data || [];
            setOrders(ordersData);
            setTransferLogs(transferRes.data || []);

            const customerIdsFromOrders = [
                ...new Set((ordersData || []).map((o) => o.customer_id).filter(Boolean)),
            ];
            /** @type {Record<string, { name?: string | null }>} */
            let customersById = {};
            if (customerIdsFromOrders.length > 0) {
                const { data: custRows } = await supabase
                    .from('customers')
                    .select('id, name')
                    .in('id', customerIdsFromOrders);
                (custRows || []).forEach((c) => {
                    if (c?.id) customersById[c.id] = c;
                });
            }

            let custLabel = '';
            setUsingCustomerOrderCode('');

            if (serial) {
                const snLinks = await fetchOrderItemsForMachineSerialVariants(supabase, serial);
                const machineItemRows = (snLinks || []).filter((it) => isMachineProductLine(it?.product_type));

                /** Khớp theo serial chuẩn hóa (máy “PLT -x” vs dòng chi tiết “PLT-x”) */
                let machineItemOrderIds = new Set(
                    machineItemRows
                        .filter((r) => normalizeMachineSerialKey(r.serial_number) === normalizeMachineSerialKey(serial))
                        .map((r) => r.order_id),
                );
                if (machineItemOrderIds.size === 0 && machineItemRows.length) {
                    machineItemOrderIds = new Set(machineItemRows.map((r) => r.order_id).filter(Boolean));
                }

                const hoanMatched = (ordersData || [])
                    .filter((o) => isOrderDeliveredCompleted(o.status) && machineItemOrderIds.has(o.id))
                    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                custLabel = resolveOrderCustomerDisplay(hoanMatched[0], customersById);
                let sourceOrderCode = hoanMatched[0]?.order_code ? String(hoanMatched[0].order_code) : '';

                if (!custLabel) {
                    const hoanRelated = (ordersData || [])
                        .filter((o) => isOrderDeliveredCompleted(o.status))
                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    custLabel = resolveOrderCustomerDisplay(hoanRelated[0], customersById);
                    if (!sourceOrderCode && hoanRelated[0]?.order_code) {
                        sourceOrderCode = String(hoanRelated[0].order_code);
                    }
                }

                setUsingCustomerOrderCode(sourceOrderCode || '');
            }

            if (!custLabel) custLabel = String(machine.customer_name || '').trim();

            setUsingCustomerLabel(custLabel || '—');
        } catch (error) {
            console.error('Error fetching machine history:', error);
            setUsingCustomerOrderCode('');
            setUsingCustomerLabel(String(machine?.customer_name || '').trim() || '—');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusStyle = (status) => {
        if (status === 'DA_DUYET' || isOrderDeliveredCompleted(status)) {
            return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        }
        if (['HUY_DON', 'DOI_SOAT_THAT_BAI'].includes(status)) {
            return 'bg-rose-50 text-rose-600 border-rose-100';
        }
        return 'bg-amber-50 text-amber-600 border-amber-100';
    };

    const timeline = [
        ...(orders || []).map((o) => ({
            type: 'ORDER',
            id: `order-${o.id}`,
            created_at: o.created_at,
            status: o.status,
            order: o,
        })),
        ...(transferLogs || []).map((t) => ({
            type: 'TRANSFER',
            id: `transfer-${t.id}`,
            created_at: t.created_at,
            status: 'DA_LUAN_CHUYEN',
            transfer: t,
        })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!machine) return null;

    const drawerContent = (
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end",
            isClosing ? "pointer-events-none" : ""
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Drawer Panel */}
            <div 
                className={clsx(
                    "font-roboto absolute top-0 right-0 h-full w-full max-w-[600px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between bg-primary/5 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                            <MonitorIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
                                Chi tiết máy {machine.serial_number}
                            </h2>
                            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-md border",
                                    machine.status === 'sẵn sàng' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                )}>
                                    {machine.status}
                                </span>
                                <span className="flex items-center gap-1.5"><Box size={14} className="text-slate-400" /> {machine.machine_type}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-2.5 bg-white text-slate-400 hover:text-primary hover:border-primary/30 rounded-xl border border-transparent hover:shadow-sm transition-all shadow-sm"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Khách / đơn — ngay dưới tiêu đề; có mã đơn để khớp với lịch sử */}
                <div className="px-6 py-4 border-b border-sky-100 bg-gradient-to-b from-sky-50/90 to-white shrink-0">
                    <div className="rounded-2xl border-2 border-sky-200 bg-white px-5 py-4 flex items-start gap-4 shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-sky-100 border border-sky-300/70 flex items-center justify-center text-sky-800 shrink-0">
                            <User className="w-6 h-6" strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-sky-800 uppercase tracking-widest mb-2">
                                Khách hàng đang sử dụng máy
                            </p>
                            <p className={clsx(
                                'text-[18px] font-black leading-snug break-words tracking-tight',
                                usingCustomerLabel && usingCustomerLabel !== '—' ? 'text-slate-900' : 'text-slate-400'
                            )}>
                                {usingCustomerLabel}
                            </p>
                            {usingCustomerOrderCode ? (
                                <p className="text-[13px] font-semibold text-slate-700 mt-2">
                                    Theo đơn:{' '}
                                    <span className="font-mono font-bold text-primary">{usingCustomerOrderCode}</span>
                                </p>
                            ) : null}
                            {(machine.status || '') !== 'thuộc khách hàng'
                                && usingCustomerLabel
                                && usingCustomerLabel !== '—' ? (
                                    <p className="text-[12px] text-slate-600 mt-2 font-medium leading-relaxed">
                                        Trạng thái kho máy hiện là «{machine.status || '—'}»; khách và mã đơn lấy từ đơn đã hoàn thành có dòng chi tiết trùng serial.
                                    </p>
                                ) : null}
                            {(!usingCustomerLabel || usingCustomerLabel === '—') && !loading ? (
                                <p className="text-[12px] text-slate-500 mt-2 font-medium leading-relaxed">
                                    Chưa khớp khách với đơn hoàn thành trong lịch sử (kiểm tra serial trên dòng chi tiết đơn và trạng thái đơn).
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Sub-header Navigation */}
                <div className="px-6 py-3 border-b border-primary/10 flex items-center gap-3 bg-white sticky top-0 z-10">
                    <button className="px-4 py-2 text-[12px] font-black tracking-wider transition-all duration-300 border-b-2 text-primary border-primary">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4" />
                            LỊCH SỬ ĐƠN HÀNG
                            <span className="bg-primary/10 text-primary py-0.5 px-2 rounded-full text-[10px]">{orders.length}</span>
                        </div>
                    </button>
                </div>

                {/* Body Details */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    <div className="p-6 space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-10 h-10 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-[13px] font-bold text-slate-400 animate-pulse uppercase tracking-[0.2em]">Đang truy xuất dữ liệu...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center max-w-xs mx-auto">
                                <Package className="w-16 h-16 text-slate-200 mb-4 stroke-[1.5]" />
                                <h3 className="text-slate-900 font-black text-base mb-1 uppercase tracking-tight">Trống lịch sử</h3>
                                <p className="text-slate-400 text-[13px] font-medium leading-relaxed">Thiết bị này chưa có biên bản giao dịch (Thuê/Trả) nào trên hệ thống.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {timeline.map((entry) => {
                                    if (entry.type === 'ORDER') {
                                        const o = entry.order;
                                        return (
                                            <div key={entry.id} className="group bg-white border border-primary/10 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Đơn hàng</span>
                                                        <span className="font-mono text-[13px] font-bold text-primary group-hover:text-primary/80">{o.order_code}</span>
                                                    </div>
                                                    <span className={clsx(
                                                        "px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg border shadow-sm",
                                                        getStatusStyle(o.status)
                                                    )}>
                                                        {o.status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2 bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                                            <MapPin size={12} className="text-indigo-400" />
                                                            Khách hàng & Loại đơn
                                                        </div>
                                                        <p className="font-black text-[14px] text-slate-800 leading-tight">{o.customer_name || o.recipient_name || '—'}</p>
                                                    </div>
                                                    <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                                            <ArrowRightLeft size={12} className="text-emerald-400" />
                                                            Tác vụ
                                                        </div>
                                                        <p className="font-bold text-[12px] text-slate-700 leading-tight">{o.product_type || '—'}</p>
                                                    </div>
                                                    <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                                            <Calendar size={12} className="text-amber-400" />
                                                            Ngày tạo
                                                        </div>
                                                        <p className="text-[12px] font-bold text-slate-700">{formatDate(o.created_at)}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isDnxmOrderRecord(o)) {
                                                                setDnxmPreviewOrderId(o.id);
                                                            } else {
                                                                setSelectedOrder(o);
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 text-[11px] font-black text-primary uppercase tracking-wider hover:underline"
                                                    >
                                                        {isDnxmOrderRecord(o) ? (
                                                            <>
                                                                <FileText size={14} className="shrink-0" />
                                                                Phiếu đề nghị xuất máy
                                                            </>
                                                        ) : (
                                                            <>
                                                                Chi tiết đơn
                                                                <ChevronRight size={14} />
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const t = entry.transfer;
                                    return (
                                        <div key={entry.id} className="group bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Luân chuyển</span>
                                                    <span className="font-mono text-[13px] font-bold text-emerald-700">{t.reference_code || 'TRF'}</span>
                                                </div>
                                                <span className="px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    Đã luân chuyển
                                                </span>
                                            </div>
                                            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                                    <ArrowRightLeft size={12} className="text-emerald-400" />
                                                    Ghi chú luân chuyển
                                                </div>
                                                <p className="text-[12px] font-bold text-slate-700 leading-tight">{t.note || '—'}</p>
                                                <p className="text-[11px] font-semibold text-slate-500 mt-2">{formatDate(t.created_at)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="px-6 py-4 bg-slate-50 border-t border-primary/10 flex items-center justify-between text-[11px] font-bold text-slate-400 tracking-wider uppercase shrink-0">
                    <div className="flex items-center gap-2">
                        <Activity size={14} />
                        PHỤ TRÁCH: {machine.department_in_charge || 'Phòng Kỹ Thuật'}
                    </div>
                    <span>{timeline.length} bản ghi</span>
                </div>

                {/* Nested Modals */}
                {selectedOrder && (
                    <OrderFormModal 
                        order={selectedOrder} 
                        initialMode="view"
                        onClose={() => setSelectedOrder(null)} 
                        onSuccess={() => {
                            setSelectedOrder(null);
                            fetchMachineHistory();
                        }}
                    />
                )}

                {dnxmPreviewOrderId && (
                    <div className="fixed inset-0 z-[100015] bg-black/80 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-5xl max-h-[94vh] bg-slate-50 rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-slate-200">
                            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
                                <h3 className="font-black text-slate-800 text-sm md:text-lg uppercase tracking-wider">
                                    Phiếu đề nghị xuất máy
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setDnxmPreviewOrderId(null)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                                    aria-label="Đóng"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                                <MachineIssueRequestForm
                                    key={dnxmPreviewOrderId}
                                    overrideOrderId={dnxmPreviewOrderId}
                                    overrideViewOnly
                                    onClosePopup={() => {
                                        setDnxmPreviewOrderId(null);
                                        fetchMachineHistory();
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
