import {
    Edit,
    PackageMinus,
    Trash2,
    Download,
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
    const [selectedIds, setSelectedIds] = useState([]);

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
            setSelectedIds([]);
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
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchIssues();
        } catch (error) {
            console.error('Error deleting issue:', error);
            alert('❌ Lỗi khi xóa phiếu: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} phiếu xuất đã chọn không? Hành động này sẽ không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('goods_issues')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchIssues();
            alert(`✅ Đã xóa ${selectedIds.length} phiếu xuất thành công!`);
        } catch (error) {
            console.error('Error deleting issues:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredIssues.length && filteredIssues.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredIssues.map(i => i.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'Mã phiếu xuất (Để trống sẽ tự tạo)',
            'Loại xuất (TRA_NCC/HUY_XUAT/TRA_VO/TRA_MAY/KHAC)',
            'Kho xuất (HN/TP.HCM/TH/DN)',
            'Nhà cung cấp nhận',
            'Ngày xuất (YYYY-MM-DD)',
            'Ghi chú phiếu',
            'Loại hàng (MAY/BINH/VAT_TU)',
            'Mã serial (hoặc mã RFID)',
            'Số lượng xuất',
        ];

        const exampleData = [
            {
                'Mã phiếu xuất (Để trống sẽ tự tạo)': 'PX00001',
                'Loại xuất (TRA_NCC/HUY_XUAT/TRA_VO/TRA_MAY/KHAC)': 'TRA_NCC',
                'Kho xuất (HN/TP.HCM/TH/DN)': 'HN',
                'Nhà cung cấp nhận': 'Công ty Oxy y tế A',
                'Ngày xuất (YYYY-MM-DD)': '2023-10-25',
                'Ghi chú phiếu': 'Xuất trả vỏ',
                'Loại hàng (MAY/BINH/VAT_TU)': 'BINH',
                'Mã serial (hoặc mã RFID)': 'OXY40-001',
                'Số lượng xuất': 1,
            },
            {
                'Mã phiếu xuất (Để trống sẽ tự tạo)': 'PX00001',
                'Loại xuất (TRA_NCC/HUY_XUAT/TRA_VO/TRA_MAY/KHAC)': 'TRA_NCC',
                'Kho xuất (HN/TP.HCM/TH/DN)': 'HN',
                'Nhà cung cấp nhận': 'Công ty Oxy y tế A',
                'Ngày xuất (YYYY-MM-DD)': '2023-10-25',
                'Ghi chú phiếu': 'Xuất trả máy',
                'Loại hàng (MAY/BINH/VAT_TU)': 'MAY',
                'Mã serial (hoặc mã RFID)': 'ROSY-001',
                'Số lượng xuất': 1,
            }
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Xuat Kho');
        XLSX.writeFile(wb, 'mau_import_phieu_xuat_kho.xlsx');
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

                const supplierMap = suppliers.reduce((acc, s) => {
                    acc[s.name.toLowerCase()] = s.id;
                    return acc;
                }, {});

                const mappedData = data.map((row, index) => {
                    const rowCode = row['Mã phiếu xuất (Để trống sẽ tự tạo)']?.toString().trim();
                    const supplierName = row['Nhà cung cấp nhận']?.toString().toLowerCase().trim();
                    return {
                        groupId: rowCode || `AUTO_GROUP_${index}`,
                        issue_code: rowCode || '',
                        issue_type: row['Loại xuất (TRA_NCC/HUY_XUAT/TRA_VO/TRA_MAY/KHAC)']?.toString().toUpperCase() || 'KHAC',
                        warehouse_id: row['Kho xuất (HN/TP.HCM/TH/DN)']?.toString().toUpperCase() || 'HN',
                        supplier_id: supplierName ? supplierMap[supplierName] || null : null,
                        issue_date: row['Ngày xuất (YYYY-MM-DD)']?.toString() || new Date().toISOString().split('T')[0],
                        notes: row['Ghi chú phiếu']?.toString() || '',
                        
                        item_type: row['Loại hàng (MAY/BINH/VAT_TU)']?.toString().toUpperCase() || 'VAT_TU',
                        item_code: row['Mã serial (hoặc mã RFID)']?.toString() || '',
                        quantity: parseInt(row['Số lượng xuất'], 10) || 1,
                    };
                }).filter(i => i.item_code || i.item_type === 'VAT_TU');

                if (mappedData.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ!');
                    setLoading(false);
                    return;
                }

                const groups = {};
                mappedData.forEach(item => {
                    if (!groups[item.groupId]) {
                        groups[item.groupId] = {
                            issue_code: item.issue_code,
                            issue_type: ["TRA_NCC", "HUY_XUAT", "KHAC", "TRA_VO", "TRA_BINH_LOI", "TRA_MAY"].includes(item.issue_type) ? item.issue_type : "KHAC",
                            warehouse_id: ["HN", "TP.HCM", "TH", "DN"].includes(item.warehouse_id) ? item.warehouse_id : "HN",
                            supplier_id: item.supplier_id,
                            issue_date: item.issue_date,
                            status: 'CHO_DUYET',
                            notes: item.notes,
                            total_items: 0,
                            items: []
                        };
                    }
                    groups[item.groupId].items.push({
                        item_type: ["MAY", "BINH", "VAT_TU", "BINH_4L", "BINH_8L", "MAY_ROSY", "MAY_MED"].includes(item.item_type) ? item.item_type : "VAT_TU",
                        item_code: item.item_code,
                        quantity: item.quantity,
                    });
                    groups[item.groupId].total_items += item.quantity;
                });

                let nextCodeNum = Date.now() % 100000; 
                let importedIssues = 0;
                let importedItems = 0;

                for (const groupId in groups) {
                    const group = groups[groupId];
                    let code = group.issue_code;
                    if (!code) {
                        code = `PX${String(nextCodeNum++).padStart(5, '0')}`;
                    }

                    const { data: insertedIssue, error: issueError } = await supabase
                        .from('goods_issues')
                        .insert([{
                            issue_code: code,
                            issue_type: group.issue_type,
                            supplier_id: group.supplier_id,
                            warehouse_id: group.warehouse_id,
                            issue_date: group.issue_date,
                            status: group.status,
                            notes: group.notes,
                            total_items: group.total_items
                        }])
                        .select('id')
                        .single();

                    if (issueError) {
                        console.error('Error inserting issue:', issueError);
                        continue;
                    }

                    importedIssues++;

                    const itemsToInsert = group.items.map(item => ({
                        ...item,
                        issue_id: insertedIssue.id
                    }));

                    const { error: itemsError } = await supabase
                        .from('goods_issue_items')
                        .insert(itemsToInsert);

                    if (itemsError) {
                        console.error('Error inserting items:', itemsError);
                    } else {
                        importedItems += itemsToInsert.length;
                    }
                }

                alert(`🎉 Đã import thành công ${importedIssues} phiếu xuất với tổng cộng ${importedItems} mục!`);
                fetchIssues();
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
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-6 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl font-black transition-all shadow-xl shadow-rose-200"
                        >
                            <Trash2 className="w-5 h-5" />
                            XÓA ({selectedIds.length})
                        </button>
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
                            {/* Mobile Select All */}
                            <div className="p-4 flex items-center gap-3 bg-gray-50 border-b border-gray-100">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded-md border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                    checked={selectedIds.length === filteredIssues.length && filteredIssues.length > 0}
                                    onChange={toggleSelectAll}
                                />
                                <span className="text-sm font-bold text-gray-600">Chọn tất cả</span>
                            </div>
                            {filteredIssues.map((issue) => (
                                <div key={issue.id} className={`p-4 hover:bg-rose-50/30 active:bg-rose-50/50 transition-colors ${selectedIds.includes(issue.id) ? 'bg-rose-50/40' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 mt-1 rounded-md border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                checked={selectedIds.includes(issue.id)}
                                                onChange={(e) => { e.stopPropagation(); toggleSelect(issue.id); }}
                                            />
                                            <div>
                                                <div className="font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg inline-block">{issue.issue_code}</div>
                                                <div className="text-xs text-slate-500 mt-1">{getTypeLabel(issue.issue_type)}</div>
                                            </div>
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
                                        <th className="px-6 py-4 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-md border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                checked={selectedIds.length === filteredIssues.length && filteredIssues.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
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
                                        <tr key={issue.id} className={`hover:bg-rose-50/30 transition-colors ${selectedIds.includes(issue.id) ? 'bg-rose-50/20' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-md border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                    checked={selectedIds.includes(issue.id)}
                                                    onChange={(e) => { e.stopPropagation(); toggleSelect(issue.id); }}
                                                />
                                            </td>
                                            <td className="px-6 py-4"><div className="font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2.5 mx-[-10px] py-1 rounded-lg inline-block">{issue.issue_code}</div><div className="text-xs text-slate-500 mt-1.5">{getTypeLabel(issue.issue_type)}</div></td>
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
