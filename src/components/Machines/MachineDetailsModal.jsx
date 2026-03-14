import {
    Activity,
    History,
    MapPin,
    MonitorIcon,
    Package,
    Thermometer,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

export default function MachineDetailsModal({ machine, onClose }) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (!machine) return;
        fetchMachineHistory();
    }, [machine]);

    const fetchMachineHistory = async () => {
        setLoading(true);
        try {
            // Lấy các Đơn hàng (Orders) có đề cập đến Serial Máy này
            // Trong quy trình, Mã Máy được nhập vào cột `department` (Khoa sd / Mã máy)
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .ilike('department', `%${machine.serial_number}%`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching machine history:', error);
            alert('Lỗi tải dữ liệu lịch sử máy!');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const getStatusStyle = (status) => {
        if (['DA_DUYET', 'HOAN_THANH'].includes(status)) {
            return 'bg-emerald-50 text-emerald-600 border-emerald-200';
        }
        if (['HUY_DON', 'DOI_SOAT_THAT_BAI'].includes(status)) {
            return 'bg-rose-50 text-rose-600 border-rose-200';
        }
        return 'bg-amber-50 text-amber-600 border-amber-200';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 rounded-t-[1.5rem] md:rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[100dvh] md:h-[80vh] mt-0 md:mt-12">

                {/* Header Profile */}
                <div className="bg-white px-4 md:px-8 py-4 md:py-6 border-b border-slate-200 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                    <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-start md:items-center gap-3 md:gap-5 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
                                <MonitorIcon className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1 tracking-tight flex items-center gap-2 md:gap-3 truncate">
                                    Máy {machine.serial_number}
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-400" /> {machine.machine_type || '—'}</span>
                                    <span className="flex items-center gap-1.5"><Thermometer className="w-4 h-4 text-slate-400" /> {machine.status || '—'}</span>
                                    {machine.customer_name && (
                                        <span className="flex items-center gap-1.5 text-indigo-600 min-w-0"><MapPin className="w-4 h-4 text-indigo-400 shrink-0" /> <span className="truncate max-w-[220px] md:max-w-[320px]">Đang ở: {machine.customer_name}</span></span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors shrink-0">
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    <div className="flex items-center mt-5 md:mt-8 border-b border-slate-200 relative z-10">
                        <button className="pb-3 md:pb-4 px-1 md:px-2 text-xs md:text-sm font-black tracking-normal md:tracking-wider transition-all duration-300 border-b-2 text-indigo-600 border-indigo-600 w-full md:w-auto">
                            <div className="flex items-center justify-center md:justify-start gap-2 min-w-0">
                                <History className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="text-center md:text-left">Lịch sử đơn hàng (Thuê / Trả)</span>
                                <span className="hidden md:inline-flex bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-[10px]">{orders.length}</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Body Details */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-4">
                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">Đang tải dữ liệu Máy móc...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                            {orders.length === 0 ? (
                                <div className="p-8 md:p-16 text-center flex flex-col items-center">
                                    <Package className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold text-base md:text-lg">Thiết bị này chưa có biên bản giao dịch nào</p>
                                </div>
                            ) : (
                                <>
                                    <div className="md:hidden space-y-3 p-3">
                                        {orders.map(o => (
                                            <div key={o.id} className="p-3 bg-white border border-slate-200 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-black text-sm text-slate-800 truncate">{o.order_code}</p>
                                                    <span className={`px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg border shrink-0 ${getStatusStyle(o.status)}`}>
                                                        {o.status}
                                                    </span>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khách hàng</p>
                                                    <p className="font-black text-sm text-slate-800 mt-1">{o.customer_name || '—'}</p>
                                                    <p className="text-[11px] text-slate-400 font-bold mt-1">{o.order_type || '—'}</p>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại hàng / Ghi chú</p>
                                                    <p className="font-bold text-sm text-slate-600 mt-1">{o.product_type || '—'}</p>
                                                    {o.note && <p className="text-[11px] opacity-70 mt-1 italic text-slate-500">{o.note}</p>}
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày tạo</p>
                                                    <p className="text-sm font-bold text-slate-700">{formatDate(o.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <table className="hidden md:table w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mã đơn</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Khách Hàng (Tên Đơn)</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loại Hàng / Ghi Chú</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày tạo</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Tình trạng</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {orders.map(o => (
                                                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-black text-sm text-slate-700">{o.order_code}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-slate-800">
                                                        <div>{o.customer_name}</div>
                                                        <div className="text-[11px] text-slate-400 font-bold mt-1">{o.order_type}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-500 max-w-[250px] truncate" title={o.note || '—'}>
                                                        <div>{o.product_type}</div>
                                                        {o.note && <div className="text-[11px] opacity-70 mt-1 italic">{o.note}</div>}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{formatDate(o.created_at)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-lg border ${getStatusStyle(o.status)}`}>
                                                            {o.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
