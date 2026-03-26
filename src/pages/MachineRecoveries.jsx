import { clsx } from 'clsx';
import {
    ChevronLeft,
    ChevronRight,
    Edit,
    FileText,
    Filter,
    LayoutGrid,
    List,
    Monitor,
    Package,
    Plus,
    Printer,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import MachineRecoveryFormModal from '../components/MachineRecovery/MachineRecoveryFormModal';
import MachineRecoveryPrintTemplate from '../components/MachineRecovery/MachineRecoveryPrintTemplate';
import { MACHINE_RECOVERY_STATUSES, MACHINE_RECOVERY_TABLE_COLUMNS } from '../constants/machineRecoveryConstants';
import { supabase } from '../supabase/config';

export default function MachineRecoveries() {
    const [recoveries, setRecoveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [recoveryToEdit, setRecoveryToEdit] = useState(null);
    const [recoveryToPrint, setRecoveryToPrint] = useState(null);

    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    useEffect(() => {
        fetchData();
        loadMetadata();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('machine_recoveries')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRecoveries(data || []);
        } catch (error) {
            toast.error('Lỗi tải dữ liệu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadMetadata = async () => {
        const { data: custData } = await supabase.from('customers').select('id, name, address');
        if (custData) setCustomers(custData);
        const { data: whData } = await supabase.from('warehouses').select('id, name');
        if (whData) setWarehouses(whData);
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || '—';
    const getCustomerAddress = (id) => customers.find(c => c.id === id)?.address || '';
    const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || id || '—';

    const filteredRecoveries = recoveries.filter(r => 
        r.recovery_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCustomerName(r.customer_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu ${code}?`)) return;
        try {
            const { error } = await supabase.from('machine_recoveries').delete().eq('id', id);
            if (error) throw error;
            toast.success(`Đã xóa phiếu ${code}`);
            fetchData();
        } catch (error) {
            toast.error('Lỗi xóa phiếu: ' + error.message);
        }
    };

    const handlePrint = (recovery) => {
        setRecoveryToPrint(recovery);
    };

    const handleStatusColor = (statusId) => {
        const found = MACHINE_RECOVERY_STATUSES.find(s => s.id === statusId);
        if (!found) return 'bg-slate-100 text-slate-600';
        switch (found.color) {
            case 'amber': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'emerald': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'rose': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusLabel = (statusId) => MACHINE_RECOVERY_STATUSES.find(s => s.id === statusId)?.label || statusId;

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider opacity-80">
                        <Monitor size={16} />
                        QUẢN LÝ THIẾT BỊ
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">THU HỒI MÁY</h1>
                    <p className="text-slate-500 font-medium text-sm">Quản lý biên bản và quy trình thu hồi máy từ khách hàng</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                        <button onClick={() => setActiveView('list')} className={clsx("p-2 rounded-xl transition-all", activeView === 'list' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-400 hover:text-slate-600")}>
                            <List size={20} />
                        </button>
                        <button onClick={() => setActiveView('stats')} className={clsx("p-2 rounded-xl transition-all", activeView === 'stats' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-400 hover:text-slate-600")}>
                            <LayoutGrid size={20} />
                        </button>
                    </div>
                    <button onClick={() => { setRecoveryToEdit(null); setIsFormModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-95 leading-none">
                        <Plus size={20} strokeWidth={3} />
                        Tạo phiếu mới
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText className="text-blue-500" />} label="Tổng số phiếu" value={recoveries.length} color="blue" />
                <StatCard icon={<Monitor className="text-emerald-500" />} label="Máy thu hồi" value={recoveries.reduce((acc, r) => acc + (r.total_items || 0), 0)} color="emerald" />
                <StatCard icon={<Clock className="text-amber-500" />} label="Chờ duyệt" value={recoveries.filter(r => r.status === 'CHO_DUYET').length} color="amber" />
                <StatCard icon={<X className="text-rose-500" />} label="Đã hủy" value={recoveries.filter(r => r.status === 'HUY').length} color="rose" />
            </div>

            {/* List and Filters */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input type="text" placeholder="Tìm theo mã phiếu, khách hàng, tài xế..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-2xl text-[14px] font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <Filter size={16} />
                            Bộ lọc
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                {MACHINE_RECOVERY_TABLE_COLUMNS.map(col => (
                                    <th key={col.key} className="px-6 py-4 text-left text-[12px] font-black text-slate-500 uppercase tracking-widest">{col.label}</th>
                                ))}
                                <th className="px-6 py-4 text-center text-[12px] font-black text-slate-500 uppercase tracking-widest">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={10} className="px-6 py-20 text-center text-slate-400 font-bold italic">Đang tải dữ liệu...</td></tr>
                            ) : filteredRecoveries.length === 0 ? (
                                <tr><td colSpan={10} className="px-6 py-20 text-center text-slate-400 font-bold italic">Không tìm thấy phiếu nào</td></tr>
                            ) : (
                                filteredRecoveries.map(r => (
                                    <tr key={r.id} className="group hover:bg-primary/5 transition-all">
                                        <td className="px-6 py-4"><span className="text-[14px] font-black text-primary hover:underline cursor-pointer" onClick={() => { setRecoveryToEdit(r); setIsFormModalOpen(true); }}>{r.recovery_code}</span></td>
                                        <td className="px-6 py-4 text-[13px] font-bold text-slate-600">{new Date(r.recovery_date).toLocaleDateString('vi-VN')}</td>
                                        <td className="px-6 py-4"><div className="text-[14px] font-black text-slate-900 line-clamp-1">{getCustomerName(r.customer_id)}</div></td>
                                        <td className="px-6 py-4 text-[13px] font-medium text-slate-500">{r.order_id ? 'Có liên kết' : '—'}</td>
                                        <td className="px-6 py-4 text-[13px] font-bold text-slate-700">{getWarehouseName(r.warehouse_id)}</td>
                                        <td className="px-6 py-4 text-[13px] font-medium text-slate-500">{r.driver_name || '—'}</td>
                                        <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-black text-xs">{r.total_items} máy</span></td>
                                        <td className="px-6 py-4">
                                            <span className={clsx("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border", handleStatusColor(r.status))}>
                                                {getStatusLabel(r.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handlePrint(r)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"><Printer size={18} /></button>
                                                <button onClick={() => { setRecoveryToEdit(r); setIsFormModalOpen(true); }} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(r.id, r.recovery_code)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Placeholder */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Hiển thị {filteredRecoveries.length} / {recoveries.length} phiếu</div>
                    <div className="flex items-center gap-2">
                        <button disabled className="p-2 rounded-xl text-slate-300 hover:bg-white disabled:opacity-50"><ChevronLeft size={18} /></button>
                        <div className="px-3 py-1 bg-primary text-white text-[12px] font-black rounded-lg shadow-sm">1</div>
                        <button disabled className="p-2 rounded-xl text-slate-300 hover:bg-white disabled:opacity-50"><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isFormModalOpen && (
                <MachineRecoveryFormModal
                    recovery={recoveryToEdit}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={() => { setIsFormModalOpen(false); fetchData(); }}
                />
            )}

            {recoveryToPrint && createPortal(
                <MachineRecoveryPrintTemplate
                    recovery={recoveryToPrint}
                    customerName={getCustomerName(recoveryToPrint.customer_id)}
                    customerAddress={getCustomerAddress(recoveryToPrint.customer_id)}
                    warehouseName={getWarehouseName(recoveryToPrint.warehouse_id)}
                    onPrinted={() => setRecoveryToPrint(null)}
                />,
                document.body
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600 ring-blue-500/10',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 ring-emerald-500/10',
        amber: 'bg-amber-50 border-amber-100 text-amber-600 ring-amber-500/10',
        rose: 'bg-rose-50 border-rose-100 text-rose-600 ring-rose-500/10',
    };

    return (
        <div className={clsx("p-5 bg-white border rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all hover:-translate-y-1", colorClasses[color] || 'border-slate-200')}>
            <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-60 leading-none">{label}</p>
                <p className="text-3xl font-black tracking-tighter text-slate-900 leading-none pt-1">{value}</p>
            </div>
            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center ring-4", colorClasses[color])}>
                {icon}
            </div>
        </div>
    );
}

function Clock(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
