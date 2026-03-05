import {
    CheckSquare,
    ChevronDown,
    Edit,
    Package,
    Plus,
    Printer,
    Search,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import GoodsReceiptPrintTemplate from '../components/GoodsReceiptPrintTemplate';
import { RECEIPT_STATUSES } from '../constants/goodsReceiptConstants';
import { WAREHOUSES } from '../constants/orderConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import { supabase } from '../supabase/config';

const TABLE_COLUMNS = [
    { key: 'code', label: 'Mã phiếu' },
    { key: 'supplier', label: 'Nhà cung cấp' },
    { key: 'warehouse', label: 'Kho nhận' },
    { key: 'date', label: 'Ngày nhập' },
    { key: 'items', label: 'Số MH' },
    { key: 'amount', label: 'Tổng giá trị' },
    { key: 'receiver', label: 'Người nhận' },
    { key: 'status', label: 'Trạng thái' },
];

const GoodsReceipts = () => {
    const navigate = useNavigate();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [warehouseFilter, setWarehouseFilter] = useState('ALL');
    const [printData, setPrintData] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_goods_receipts', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

    useEffect(() => {
        fetchReceipts();
    }, []);

    const fetchReceipts = async () => {
        try {
            const { data, error } = await supabase
                .from('goods_receipts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReceipts(data || []);
        } catch (error) {
            console.error('Error loading receipts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteReceipt = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu nhập "${code}" không? Hành động này sẽ không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('goods_receipts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchReceipts();
        } catch (error) {
            console.error('Error deleting receipt:', error);
            alert('❌ Lỗi khi xóa phiếu nhập: ' + error.message);
        }
    };

    const handlePrintReceipt = async (receipt) => {
        try {
            const { data: items, error } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('receipt_id', receipt.id);

            if (error) throw error;

            setPrintData({ receipt, items: items || [] });
            setTimeout(() => {
                window.print();
            }, 300);
        } catch (error) {
            console.error('Error fetching items for print:', error);
            alert('❌ Lỗi khi tải dữ liệu in: ' + error.message);
        }
    };

    const handleApproveReceipt = async (receipt) => {
        if (!window.confirm(`Xác nhận duyệt phiếu nhập "${receipt.receipt_code}"?\nHàng hóa sẽ được cộng vào tồn kho và không thể hoàn tác.`)) {
            return;
        }

        try {
            // 1. Fetch receipt items
            const { data: items, error: itemsError } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('receipt_id', receipt.id);

            if (itemsError) throw itemsError;
            if (!items || items.length === 0) {
                alert('⚠️ Phiếu nhập không có hàng hóa, không thể duyệt!');
                return;
            }

            // 2. Loop through items to update inventory
            for (const item of items) {
                // Upsert inventory
                const { data: invData, error: invQueryError } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', receipt.warehouse_id)
                    .eq('item_type', item.item_type)
                    .eq('item_name', item.item_name)
                    .maybeSingle();

                if (invQueryError) throw invQueryError;

                let inventoryId;
                if (invData) {
                    // Update
                    const { data: updatedInv, error: updateError } = await supabase
                        .from('inventory')
                        .update({ quantity: invData.quantity + item.quantity })
                        .eq('id', invData.id)
                        .select()
                        .single();
                    if (updateError) throw updateError;
                    inventoryId = updatedInv.id;
                } else {
                    // Insert
                    const { data: newInv, error: insertError } = await supabase
                        .from('inventory')
                        .insert([{
                            warehouse_id: receipt.warehouse_id,
                            item_type: item.item_type,
                            item_name: item.item_name,
                            quantity: item.quantity
                        }])
                        .select()
                        .single();
                    if (insertError) throw insertError;
                    inventoryId = newInv.id;
                }

                // Create transaction record
                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert([{
                        inventory_id: inventoryId,
                        transaction_type: 'IN',
                        reference_id: receipt.id,
                        reference_code: receipt.receipt_code,
                        quantity_changed: item.quantity,
                        note: `Duyệt phiếu nhập ${receipt.receipt_code}`
                    }]);
                if (txError) throw txError;
            }

            // 3. Update receipt status
            const { error: updateReceiptError } = await supabase
                .from('goods_receipts')
                .update({ status: 'DA_NHAP' })
                .eq('id', receipt.id);

            if (updateReceiptError) throw updateReceiptError;

            alert('✅ Đã duyệt phiếu nhập và cập nhật tồn kho thành công!');
            fetchReceipts();
        } catch (error) {
            console.error('Error approving receipt:', error);
            alert('❌ Lỗi khi duyệt phiếu: ' + error.message);
        }
    };

    const getStatusBadge = (status) => {
        const statusObj = RECEIPT_STATUSES.find(s => s.id === status);
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

    const getWarehouseLabel = (id) => {
        return WAREHOUSES.find(w => w.id === id)?.label || id;
    };

    const filteredReceipts = receipts.filter(r => {
        const matchSearch = !searchTerm ||
            r.receipt_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchWarehouse = warehouseFilter === 'ALL' || r.warehouse_id === warehouseFilter;
        return matchSearch && matchStatus && matchWarehouse;
    });

    const stats = {
        total: receipts.length,
        pending: receipts.filter(r => r.status === 'CHO_DUYET').length,
        imported: receipts.filter(r => r.status === 'DA_NHAP').length,
        completed: receipts.filter(r => r.status === 'HOAN_THANH').length,
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-emerald w-[400px] h-[400px] -top-20 -right-20 opacity-15"></div>
            <div className="blob blob-teal w-[300px] h-[300px] bottom-1/3 -left-20 opacity-10"></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/trang-chu')} className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-all shadow-sm">
                        ←
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Package className="w-8 h-8 text-emerald-600" />
                        Nhập hàng từ NCC
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/tao-phieu-nhap')}
                        className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-5 h-5" />
                        Tạo phiếu nhập mới
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 relative z-10">
                {[
                    { label: 'Tổng phiếu', value: stats.total, color: 'from-gray-500 to-gray-600', bg: 'bg-gray-50' },
                    { label: 'Chờ duyệt', value: stats.pending, color: 'from-yellow-500 to-amber-600', bg: 'bg-yellow-50' },
                    { label: 'Đã nhập kho', value: stats.imported, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
                    { label: 'Hoàn thành', value: stats.completed, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50' },
                ].map((stat, idx) => (
                    <div key={idx} className={`${stat.bg} rounded-2xl p-5 border border-white shadow-sm`}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                        <p className={`text-3xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white p-4 md:p-6 mb-6 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm mã phiếu, NCC..."
                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 cursor-pointer appearance-none transition-all"
                        >
                            {RECEIPT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select
                            value={warehouseFilter}
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 cursor-pointer appearance-none transition-all"
                        >
                            <option value="ALL">Tất cả kho</option>
                            {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="flex items-center justify-end mt-4">
                    <ColumnToggle columns={TABLE_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetColumns} visibleCount={visibleCount} totalCount={totalCount} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-emerald-900/10 border border-white overflow-hidden relative z-10">
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400 font-bold">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="p-16 text-center">
                        <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-lg mb-2">Chưa có phiếu nhập nào</p>
                        <p className="text-gray-300 text-sm">Nhấn "Tạo phiếu nhập mới" để bắt đầu</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-100">
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center w-16">STT</th>
                                    {visibleTableColumns.map(col => (
                                        <th key={col.key} className={`px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ${col.key === 'items' || col.key === 'status' ? 'text-center' : ''}`}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center sticky right-0 bg-white/50 backdrop-blur-sm">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredReceipts.map((receipt, idx) => (
                                    <tr key={receipt.id} className="hover:bg-emerald-50/30 transition-colors cursor-pointer">
                                        <td className="px-6 py-5 text-center text-sm font-bold text-gray-400">{idx + 1}</td>
                                        {isColumnVisible('code') && <td className="px-6 py-5">
                                            <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                {receipt.receipt_code}
                                            </span>
                                        </td>}
                                        {isColumnVisible('supplier') && <td className="px-6 py-5 font-bold text-slate-900 text-sm">{receipt.supplier_name}</td>}
                                        {isColumnVisible('warehouse') && <td className="px-6 py-5">
                                            <span className="text-sm font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                {getWarehouseLabel(receipt.warehouse_id)}
                                            </span>
                                        </td>}
                                        {isColumnVisible('date') && <td className="px-6 py-5 text-sm font-bold text-gray-600">
                                            {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('vi-VN') : '—'}
                                        </td>}
                                        {isColumnVisible('items') && <td className="px-6 py-5 text-center text-sm font-black text-slate-900">{receipt.total_items}</td>}
                                        {isColumnVisible('amount') && <td className="px-6 py-5 text-right font-black text-rose-600">
                                            {new Intl.NumberFormat('vi-VN').format(receipt.total_amount || 0)} ₫
                                        </td>}
                                        {isColumnVisible('receiver') && <td className="px-6 py-5 text-sm font-bold text-gray-600">{receipt.received_by || '—'}</td>}
                                        {isColumnVisible('status') && <td className="px-6 py-5 text-center">{getStatusBadge(receipt.status)}</td>}
                                        <td className="px-6 py-5 text-center sticky right-0 bg-white/50 backdrop-blur-md group-hover:bg-emerald-50/10 transition-colors">
                                            <div className="flex items-center justify-center gap-5 transition-all">
                                                {receipt.status === 'CHO_DUYET' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleApproveReceipt(receipt); }}
                                                        className="text-emerald-500 hover:text-emerald-700 transition-all outline-none"
                                                        title="Duyệt (Nhập kho)"
                                                    >
                                                        <CheckSquare className="w-5 h-5 flex-shrink-0" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handlePrintReceipt(receipt); }}
                                                    className="text-slate-400 hover:text-blue-600 transition-all outline-none"
                                                    title="In phiếu nhập"
                                                >
                                                    <Printer className="w-5 h-5 flex-shrink-0" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate('/tao-phieu-nhap', { state: { receipt } }); }}
                                                    className="text-slate-400 hover:text-slate-900 transition-all outline-none"
                                                    title={receipt.status === 'CHO_DUYET' ? "Chỉnh sửa" : "Xem chi tiết"}
                                                >
                                                    <Edit className="w-5 h-5 flex-shrink-0" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteReceipt(receipt.id, receipt.receipt_code); }}
                                                    className="text-slate-400 hover:text-red-500 transition-all outline-none"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-5 h-5 flex-shrink-0" />
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

            {/* Hidden Print Template — rendered via Portal directly under <body> to bypass #root hiding */}
            {printData && createPortal(
                <div className="print-only-content">
                    <GoodsReceiptPrintTemplate receipt={printData?.receipt} items={printData?.items} />
                </div>,
                document.body
            )}
        </div>
    );
};

export default GoodsReceipts;
