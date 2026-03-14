import {
    Edit,
    PackageMinus,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ISSUE_STATUSES, ISSUE_TABLE_COLUMNS, ISSUE_TYPES } from '../constants/goodsIssueConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import { supabase } from '../supabase/config';

const GoodsIssues = () => {
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [warehouseFilter, setWarehouseFilter] = useState('ALL');
    const [warehousesList, setWarehousesList] = useState([]);

    // We reuse logical columns hook
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_goods_issues', ISSUE_TABLE_COLUMNS);
    const visibleTableColumns = ISSUE_TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

    useEffect(() => {
        loadSuppliers();
        fetchIssues();
        fetchWarehouses();
    }, []);

    const loadSuppliers = async () => {
        try {
            const { data, error } = await supabase.from('suppliers').select('id, name');
            if (!error && data) setSuppliers(data);
        } catch (e) { }
    }

    const fetchIssues = async () => {
        try {
            const { data, error } = await supabase
                .from('goods_issues')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setIssues(data || []);
        } catch (error) {
            console.error('Error loading issues:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const handleDeleteIssue = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu xuất "${code}" không? Hành động này sẽ không thể hoàn tác.`)) return;

        try {
            const { error } = await supabase.from('goods_issues').delete().eq('id', id);
            if (error) throw error;
            fetchIssues();
        } catch (error) {
            console.error('Error deleting issue:', error);
            alert('❌ Lỗi khi xóa phiếu: ' + error.message);
        }
    };

    const getStatusBadge = (status) => {
        const statusObj = ISSUE_STATUSES.find(s => s.id === status);
        if (!statusObj) return <span className="text-gray-400">—</span>;

        const colorMap = {
            yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            red: 'bg-red-50 text-red-700 border-red-200',
            gray: 'bg-gray-50 text-gray-700 border-gray-200',
        };

        return (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${colorMap[statusObj.color] || colorMap.gray}`}>
                {statusObj.label}
            </span>
        );
    };

    const getWarehouseLabel = (id) => warehousesList.find(w => w.id === id)?.name || id;
    const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || id;
    const getTypeLabel = (typeId) => ISSUE_TYPES.find(t => t.id === typeId)?.label || typeId;

    const filteredIssues = issues.filter(r => {
        const matchSearch = !searchTerm ||
            r.issue_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchWarehouse = warehouseFilter === 'ALL' || r.warehouse_id === warehouseFilter;
        return matchSearch && matchStatus && matchWarehouse;
    });

    const stats = {
        total: issues.length,
        completed: issues.filter(r => r.status === 'HOAN_THANH').length,
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans min-h-screen noise-bg">
            <div className="blob blob-rose w-[400px] h-[400px] -top-20 -right-20 opacity-15"></div>
            <div className="blob blob-indigo w-[300px] h-[300px] bottom-1/3 -left-20 opacity-10"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <PackageMinus className="w-8 h-8 text-rose-600" />
                        Lịch sử xuất vỏ/máy
                    </h1>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => navigate('/tao-phieu-xuat', { state: { forcedType: 'TRA_VO' } })}
                        className="flex items-center gap-2 px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-rose-200"
                    >
                        <PackageMinus className="w-5 h-5" /> XUẤT TRẢ VỎ
                    </button>
                    <button
                        onClick={() => navigate('/tao-phieu-xuat', { state: { forcedType: 'TRA_MAY' } })}
                        className="flex items-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black transition-all shadow-xl shadow-slate-200"
                    >
                        <PackageMinus className="w-5 h-5" /> XUẤT TRẢ MÁY
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">
                {[
                    { label: 'Tổng số phiếu', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
                    { label: 'Hoàn thành', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50' }
                ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} p-6 rounded-2xl border border-gray-100 shadow-sm`}>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</div>
                        <div className={`text-4xl font-black mt-2 ${stat.color}`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-rose-900/10 border border-white overflow-hidden relative z-10">
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400 font-bold">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredIssues.length === 0 ? (
                    <div className="p-16 text-center">
                        <PackageMinus className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-lg mb-2">Chưa có phiếu xuất nào</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredIssues.map((issue) => (
                                <div key={issue.id} className="p-4 hover:bg-rose-50/30 active:bg-rose-50/50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="font-bold text-slate-800">{issue.issue_code}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{getTypeLabel(issue.issue_type)}</div>
                                        </div>
                                        {getStatusBadge(issue.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Ngày</span><p className="text-xs font-medium text-slate-600">{new Date(issue.issue_date).toLocaleDateString()}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">SL</span><p className="text-xs font-black text-slate-700">{issue.total_items}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Kho</span><p className="text-xs font-medium text-slate-800">{getWarehouseLabel(issue.warehouse_id)}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">NCC</span><p className="text-xs font-bold text-rose-600">{getSupplierName(issue.supplier_id)}</p></div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                                        <button onClick={() => navigate('/tao-phieu-xuat', { state: { issue } })} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>
                                        <button onClick={() => handleDeleteIssue(issue.id, issue.issue_code)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Phiếu</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Ngày</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Kho & NCC</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">SL</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredIssues.map((issue) => (
                                        <tr key={issue.id} className="hover:bg-rose-50/30 transition-colors">
                                            <td className="px-6 py-4"><div className="font-bold text-slate-800">{issue.issue_code}</div><div className="text-xs text-slate-500 mt-1">{getTypeLabel(issue.issue_type)}</div></td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{new Date(issue.issue_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><div className="font-medium text-slate-800">{getWarehouseLabel(issue.warehouse_id)}</div><div className="text-xs text-rose-600 font-bold mt-1">{"➞ " + getSupplierName(issue.supplier_id)}</div></td>
                                            <td className="px-6 py-4 text-center font-black text-slate-700">{issue.total_items}</td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(issue.status)}</td>
                                            <td className="px-6 py-4"><div className="flex justify-end gap-3">
                                                <button onClick={() => navigate('/tao-phieu-xuat', { state: { issue } })} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteIssue(issue.id, issue.issue_code)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoodsIssues;
