import {
    Activity,
    History,
    MapPin,
    MonitorIcon,
    Package,
    Thermometer,
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
import OrderFormModal from '../Orders/OrderFormModal';

export default function MachineDetailsModal({ machine, onClose }) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [isClosing, setIsClosing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        if (!machine) return;
        fetchMachineHistory();
    }, [machine]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const fetchMachineHistory = async () => {
        setLoading(true);
        try {
            const [ordersRes, transferRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*')
                    .ilike('department', `%${machine.serial_number}%`)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('inventory_transactions')
                    .select('*')
                    .eq('transaction_type', 'OUT')
                    .like('reference_code', 'TRF%')
                    .ilike('note', `%${machine.serial_number}%`)
                    .order('created_at', { ascending: false })
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (transferRes.error) throw transferRes.error;

            setOrders(ordersRes.data || []);
            setTransferLogs(transferRes.data || []);
        } catch (error) {
            console.error('Error fetching machine history:', error);
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
        if (['DA_DUYET', 'HOAN_THANH'].includes(status)) {
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
                    "absolute top-0 right-0 h-full w-full max-w-[600px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500",
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
                                                        <p className="font-black text-[14px] text-slate-800 leading-tight">{o.customer_name || '—'}</p>
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
                                                        onClick={() => setSelectedOrder(o)}
                                                        className="flex items-center gap-1.5 text-[11px] font-black text-primary uppercase tracking-wider hover:underline"
                                                    >
                                                        CHI TIẾT ĐƠN
                                                        <ChevronRight size={14} />
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
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
