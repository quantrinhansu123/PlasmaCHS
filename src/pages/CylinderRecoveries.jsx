import {
    Edit,
    FileText,
    PackageCheck,
    Printer,
    Search,
    Trash2,
    Download,
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import CylinderRecoveryPrintTemplate from '../components/CylinderRecovery/CylinderRecoveryPrintTemplate';
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
    const [recoveriesToPrint, setRecoveriesToPrint] = useState(null);

    const [warehousesList, setWarehousesList] = useState([]);

    useEffect(() => {
        fetchRecoveries();
        loadCustomers();
        loadOrders();
        fetchWarehouses();
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
            setSelectedIds([]); // Clear selection when fetching newly
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

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Xóa phiếu "${code}"?`)) return;
        try {
            await supabase.from('cylinder_recoveries').delete().eq('id', id);
            setSelectedIds(prev => prev.filter(x => x !== id));
            fetchRecoveries();
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phiếu thu hồi đã chọn không? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('cylinder_recoveries')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchRecoveries();
            alert(`✅ Đã xóa ${selectedIds.length} phiếu thu hồi thành công!`);
        } catch (error) {
            console.error('Error deleting recoveries:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || id || '—';
    const getWarehouseLabel = (id) => warehousesList.find(w => w.id === id)?.name || id;
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

    const handleDownloadTemplate = () => {
        const headers = [
            'Mã phiếu thu hồi (Để trống sẽ tự tạo)',
            'Khách hàng thu hồi',
            'Kho nhập về (HN/TP.HCM/TH/DN)',
            'Người vận chuyển (Lái xe)',
            'Ngày thu hồi (YYYY-MM-DD)',
            'Ghi chú phiếu',
            'Mã bình (Serial)',
            'Tình trạng võ (tot/hong/meo/khac)',
            'Ghi chú bình'
        ];

        const exampleData = [
            {
                'Mã phiếu thu hồi (Để trống sẽ tự tạo)': 'TH00001',
                'Khách hàng thu hồi': 'Bệnh viện Chợ Rẫy',
                'Kho nhập về (HN/TP.HCM/TH/DN)': 'HN',
                'Người vận chuyển (Lái xe)': 'Nguyễn Văn Tài xế',
                'Ngày thu hồi (YYYY-MM-DD)': '2023-11-20',
                'Ghi chú phiếu': 'Thu hồi định kỳ',
                'Mã bình (Serial)': 'OXY-40L-001',
                'Tình trạng võ (tot/hong/meo/khac)': 'tot',
                'Ghi chú bình': ''
            },
            {
                'Mã phiếu thu hồi (Để trống sẽ tự tạo)': 'TH00001',
                'Khách hàng thu hồi': 'Bệnh viện Chợ Rẫy',
                'Kho nhập về (HN/TP.HCM/TH/DN)': 'HN',
                'Người vận chuyển (Lái xe)': 'Nguyễn Văn Tài xế',
                'Ngày thu hồi (YYYY-MM-DD)': '2023-11-20',
                'Ghi chú phiếu': 'Thu hồi định kỳ',
                'Mã bình (Serial)': 'OXY-40L-002',
                'Tình trạng võ (tot/hong/meo/khac)': 'hong',
                'Ghi chú bình': 'Bị móp nhẹ'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Thu Hoi Vo');
        XLSX.writeFile(wb, 'mau_import_thu_hoi_vo.xlsx');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('File Excel không có dữ liệu!');
                    return;
                }

                setLoading(true);

                const customerMap = customers.reduce((acc, c) => {
                    acc[c.name.toLowerCase().trim()] = c.id;
                    return acc;
                }, {});

                const mappedData = data.map((row, index) => {
                    const rowCode = row['Mã phiếu thu hồi (Để trống sẽ tự tạo)']?.toString().trim();
                    const customerName = row['Khách hàng thu hồi']?.toString().toLowerCase().trim();
                    return {
                        groupId: rowCode || `AUTO_GROUP_${index}`,
                        recovery_code: rowCode || '',
                        customer_id: customerName ? customerMap[customerName] || null : null,
                        warehouse_id: row['Kho nhập về (HN/TP.HCM/TH/DN)']?.toString().toUpperCase() || 'HN',
                        driver_name: row['Người vận chuyển (Lái xe)']?.toString() || '',
                        recovery_date: row['Ngày thu hồi (YYYY-MM-DD)']?.toString() || new Date().toISOString().split('T')[0],
                        notes: row['Ghi chú phiếu']?.toString() || '',
                        
                        serial_number: row['Mã bình (Serial)']?.toString() || '',
                        condition: row['Tình trạng võ (tot/hong/meo/khac)']?.toString().toLowerCase() || 'tot',
                        note: row['Ghi chú bình']?.toString() || '',
                    };
                }).filter(i => i.serial_number);

                if (mappedData.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu Mã bình)!');
                    setLoading(false);
                    return;
                }

                const groups = {};
                mappedData.forEach(item => {
                    if (!groups[item.groupId]) {
                        groups[item.groupId] = {
                            recovery_code: item.recovery_code,
                            customer_id: item.customer_id,
                            warehouse_id: ["HN", "TP.HCM", "TH", "DN"].includes(item.warehouse_id) ? item.warehouse_id : "HN",
                            driver_name: item.driver_name,
                            recovery_date: item.recovery_date,
                            status: 'CHO_DUYET',
                            notes: item.notes,
                            total_items: 0,
                            items: []
                        };
                    }
                    groups[item.groupId].items.push({
                        serial_number: item.serial_number,
                        condition: ["tot", "hong", "meo", "khac"].includes(item.condition) ? item.condition : "tot",
                        note: item.note,
                    });
                    groups[item.groupId].total_items += 1;
                });

                let nextCodeNum = Date.now() % 100000; 
                let importedRecoveries = 0;
                let importedItems = 0;

                for (const groupId in groups) {
                    const group = groups[groupId];
                    let code = group.recovery_code;
                    if (!code) {
                        code = `TH${String(nextCodeNum++).padStart(5, '0')}`;
                    }

                    const { data: insertedRecovery, error: recoveryError } = await supabase
                        .from('cylinder_recoveries')
                        .insert([{
                            recovery_code: code,
                            customer_id: group.customer_id,
                            warehouse_id: group.warehouse_id,
                            driver_name: group.driver_name,
                            recovery_date: group.recovery_date,
                            status: group.status,
                            notes: group.notes,
                            total_items: group.total_items
                        }])
                        .select('id')
                        .single();

                    if (recoveryError) {
                        console.error('Error inserting recovery:', recoveryError);
                        continue;
                    }

                    importedRecoveries++;

                    const itemsToInsert = group.items.map(item => ({
                        ...item,
                        recovery_id: insertedRecovery.id
                    }));

                    const { error: itemsError } = await supabase
                        .from('cylinder_recovery_items')
                        .insert(itemsToInsert);

                    if (itemsError) {
                        console.error('Error inserting items:', itemsError);
                    } else {
                        importedItems += itemsToInsert.length;
                    }
                }

                alert(`🎉 Đã import thành công ${importedRecoveries} phiếu thu hồi với tổng cộng ${importedItems} vỏ bình!`);
                fetchRecoveries();
            } catch (err) {
                console.error('Error importing excel:', err);
                alert('Có lỗi xảy ra khi xử lý file: ' + err.message);
            } finally {
                setLoading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    const handlePrintSingle = (recovery) => {
        setRecoveriesToPrint([{
            ...recovery,
            customerName: getCustomerName(recovery.customer_id)
        }]);
    };

    const handleBatchPrint = () => {
        if (selectedIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 phiếu!');
            return;
        }
        const selected = recoveries
            .filter(r => selectedIds.includes(r.id))
            .map(r => ({
                ...r,
                customerName: getCustomerName(r.customer_id)
            }));
        setRecoveriesToPrint(selected);
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
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <PackageCheck className="w-8 h-8 text-blue-600" />
                        Phiếu thu hồi vỏ bình
                    </h1>
                </div>
                <div className="flex gap-3">
                    {selectedIds.length > 0 && (
                        <>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold transition-all shadow-sm"
                            >
                                <Trash2 className="w-5 h-5" /> Xóa ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleBatchPrint}
                                className="flex items-center gap-2 px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl font-bold transition-all"
                            >
                                <Printer className="w-5 h-5" /> In ({selectedIds.length})
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-200"
                        title="Tải mẫu Excel"
                    >
                        <Download className="w-5 h-5" />
                        <span className="hidden sm:inline">Tải mẫu</span>
                    </button>
                    <label className="flex items-center gap-2 px-5 py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-blue-200 cursor-pointer" title="Nhập Excel">
                        <Upload className="w-5 h-5" />
                        <span className="hidden sm:inline">Nhập file</span>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportExcel}
                            className="hidden"
                        />
                    </label>
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
                    <>
                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {/* Mobile Select All */}
                            <div className="p-4 flex items-center gap-3 bg-gray-50 border-b border-gray-100">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedIds.length === filteredRecoveries.length && filteredRecoveries.length > 0}
                                    onChange={toggleSelectAll}
                                />
                                <span className="text-sm font-bold text-gray-600">Chọn tất cả</span>
                            </div>
                            {filteredRecoveries.map(r => (
                                <div key={r.id} className={`p-4 hover:bg-blue-50/30 active:bg-blue-50/50 transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/40' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded accent-blue-600 mt-1" />
                                            <div>
                                                <div className="font-bold text-slate-800">{r.recovery_code}</div>
                                                {r.driver_name && <div className="text-xs text-slate-500 mt-0.5">NV: {r.driver_name}</div>}
                                            </div>
                                        </div>
                                        {getStatusBadge(r.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Ngày</span><p className="text-xs font-medium text-slate-600">{new Date(r.recovery_date).toLocaleDateString('vi-VN')}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">SL vỏ</span><p className="text-xs font-black text-slate-700">{r.total_items}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Khách hàng</span><p className="text-xs font-medium text-slate-800">{getCustomerName(r.customer_id)}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Đơn hàng</span><p className="text-xs font-medium text-blue-600">{getOrderCode(r.order_id)}</p></div>
                                        <div className="col-span-2"><span className="text-[9px] font-bold text-gray-400 uppercase">Kho nhận</span><p className="text-xs text-slate-600">{getWarehouseLabel(r.warehouse_id)}</p></div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-50">
                                        <button onClick={() => handlePrintSingle(r)} className="p-2 text-slate-400 hover:text-amber-600 rounded-lg transition-colors" title="In phiếu"><Printer className="w-5 h-5" /></button>
                                        <button onClick={() => navigate('/tao-phieu-thu-hoi', { state: { recovery: r } })} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(r.id, r.recovery_code)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-4 py-4 text-center w-12"><input type="checkbox" checked={selectedIds.length === filteredRecoveries.length && filteredRecoveries.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-blue-600" /></th>
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
                                            <td className="px-4 py-4 text-center"><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded accent-blue-600" /></td>
                                            <td className="px-6 py-4"><div className="font-bold text-slate-800">{r.recovery_code}</div>{r.driver_name && <div className="text-xs text-slate-500 mt-1">NV: {r.driver_name}</div>}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{new Date(r.recovery_date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-6 py-4 font-medium text-slate-800">{getCustomerName(r.customer_id)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-blue-600">{getOrderCode(r.order_id)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{getWarehouseLabel(r.warehouse_id)}</td>
                                            <td className="px-6 py-4 text-center font-black text-slate-700">{r.total_items}</td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(r.status)}</td>
                                            <td className="px-6 py-4"><div className="flex justify-end gap-2">
                                                <button onClick={() => handlePrintSingle(r)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors" title="In phiếu"><Printer className="w-4 h-4" /></button>
                                                <button onClick={() => navigate('/tao-phieu-thu-hoi', { state: { recovery: r } })} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(r.id, r.recovery_code)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Hidden Print Template */}
            {createPortal(
                <div className="print-only-container">
                    {recoveriesToPrint?.map((rec, idx) => (
                        <div key={rec.id}>
                            <CylinderRecoveryPrintTemplate 
                                recovery={rec} 
                                customerName={rec.customerName}
                                onPrinted={idx === recoveriesToPrint.length - 1 ? () => setRecoveriesToPrint(null) : null}
                            />
                            {idx < recoveriesToPrint.length - 1 && <div style={{ pageBreakAfter: 'always' }} />}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CylinderRecoveries;
