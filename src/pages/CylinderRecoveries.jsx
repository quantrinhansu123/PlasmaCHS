import {
    Edit,
    FileText,
    PackageCheck,
    Printer,
    Search,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WAREHOUSES } from '../constants/orderConstants';
import { RECOVERY_STATUSES } from '../constants/recoveryConstants';
import { supabase } from '../supabase/config';

const CylinderRecoveries = () => {
    const navigate = useNavigate();
    const [recoveries, setRecoveries] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchRecoveries();
        loadCustomers();
        loadOrders();
    }, []);

    const loadCustomers = async () => {
        const { data } = await supabase.from('customers').select('id, name').order('name');
        if (data) setCustomers(data);
    };

    const [orders, setOrders] = useState([]);
    const loadOrders = async () => {
        const { data } = await supabase.from('orders').select('id, order_code').order('created_at', { ascending: false });
        if (data) setOrders(data);
    };

    const fetchRecoveries = async () => {
        try {
            const { data, error } = await supabase
                .from('cylinder_recoveries')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRecoveries(data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Xóa phiếu "${code}"?`)) return;
        try {
            await supabase.from('cylinder_recoveries').delete().eq('id', id);
            fetchRecoveries();
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || id || '—';
    const getWarehouseLabel = (id) => WAREHOUSES.find(w => w.id === id)?.label || id;
    const getSupplierName = (id) => customers.find(c => c.id === id)?.name || id || '—';
    const getOrderCode = (id) => {
        if (!id) return '—';
        const order = orders.find(o => o.id === id);
        return order ? `ĐH ${order.order_code}` : '—';
    };

    const getStatusBadge = (status) => {
        const s = RECOVERY_STATUSES.find(r => r.id === status);
        if (!s) return <span className="text-gray-400">—</span>;
        const colors = {
            yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            red: 'bg-red-50 text-red-700 border-red-200',
            gray: 'bg-gray-50 text-gray-700 border-gray-200',
        };
        return <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${colors[s.color] || colors.gray}`}>{s.label}</span>;
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredRecoveries.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRecoveries.map(r => r.id));
        }
    };

    const handleBatchPrint = async () => {
        if (selectedIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 phiếu!');
            return;
        }
        // Dynamically import PDF generator
        const { generateRecoveryPDF } = await import('../utils/recoveryPDF');
        const selected = recoveries.filter(r => selectedIds.includes(r.id));

        for (const recovery of selected) {
            const { data: items } = await supabase
                .from('cylinder_recovery_items')
                .select('*')
                .eq('recovery_id', recovery.id);

            const customerName = getCustomerName(recovery.customer_id);
            await generateRecoveryPDF(recovery, items || [], customerName);
        }

        alert(`🎉 Đã xuất ${selected.length} phiếu PDF!`);
    };

    const filteredRecoveries = recoveries.filter(r => {
        const matchSearch = !searchTerm || r.recovery_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans min-h-screen noise-bg">
            <div className="blob blob-blue w-[400px] h-[400px] -top-20 -right-20 opacity-15"></div>
            <div className="blob blob-indigo w-[300px] h-[300px] bottom-1/3 -left-20 opacity-10"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/trang-chu')} className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-all shadow-sm">
                        ←
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <PackageCheck className="w-8 h-8 text-blue-600" />
                        Phiếu thu hồi vỏ bình
                    </h1>
                </div>
                <div className="flex gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBatchPrint}
                            className="flex items-center gap-2 px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl font-bold transition-all"
                        >
                            <Printer className="w-5 h-5" /> In {selectedIds.length} phiếu
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/tao-phieu-thu-hoi')}
                        className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-blue-200"
                    >
                        <PackageCheck className="w-5 h-5" /> TẠO PHIẾU THU HỒI
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 relative z-10">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm mã phiếu..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-sm cursor-pointer outline-none"
                >
                    {RECOVERY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-white overflow-hidden relative z-10">
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400 font-bold">Đang tải...</p>
                    </div>
                ) : filteredRecoveries.length === 0 ? (
                    <div className="p-16 text-center">
                        <PackageCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-lg">Chưa có phiếu thu hồi nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-4 py-4 text-center w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredRecoveries.length && filteredRecoveries.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded accent-blue-600"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Phiếu</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Ngày</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Khách hàng</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Đơn hàng</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Kho nhận</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">SL vỏ</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredRecoveries.map(r => (
                                    <tr key={r.id} className={`hover:bg-blue-50/30 transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/40' : ''}`}>
                                        <td className="px-4 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(r.id)}
                                                onChange={() => toggleSelect(r.id)}
                                                className="w-4 h-4 rounded accent-blue-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{r.recovery_code}</div>
                                            {r.driver_name && <div className="text-xs text-slate-500 mt-1">NV: {r.driver_name}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                            {new Date(r.recovery_date).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{getCustomerName(r.customer_id)}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{getOrderCode(r.order_id)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{getWarehouseLabel(r.warehouse_id)}</td>
                                        <td className="px-6 py-4 text-center font-black text-slate-700">{r.total_items}</td>
                                        <td className="px-6 py-4 text-center">{getStatusBadge(r.status)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const { generateRecoveryPDF } = await import('../utils/recoveryPDF');
                                                        const { data: items } = await supabase.from('cylinder_recovery_items').select('*').eq('recovery_id', r.id);
                                                        generateRecoveryPDF(r, items || [], getCustomerName(r.customer_id));
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-amber-600 transition-colors" title="Xuất PDF"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => navigate('/tao-phieu-thu-hoi', { state: { recovery: r } })} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(r.id, r.recovery_code)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CylinderRecoveries;
